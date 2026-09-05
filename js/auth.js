// アカウント機能（Supabase認証）。
// ユーザー名+パスワードでサインアップ/サインインするまでアプリ本体を表示しない。
// ログイン後は、既存のlocalStorageキーとSupabase（クラウド）を自動的に同期し、
// 別端末・別ブラウザでも同じユーザー名でログインすれば進捗を復元できるようにする。
// 既存のゲームロジック（Progress/MapProgress/DailyQuest/Playgroundなど）は一切変更しない。

const AUTH_EMAIL_DOMAIN = "codetrek-app.com"; // Supabase Authのメール欄用にユーザー名を変換するための仮ドメイン（.localはSupabase側で無効なアドレス扱いになるため使用不可）

// localStorageのキー ⇔ Supabase user_dataテーブルの列 の対応
const SYNCED_KEYS = {
  codetango_progress: "progress",
  codetango_map: "map",
  codetango_daily_quest: "daily_quest",
  codetango_home_lang: "home_lang",
  codetango_playground: "playground",
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Auth = {
  currentUserId: null,
  currentEmail: null,
  currentUsername: null,
  _hydrating: false,
  _syncTimer: null,

  init() {
    this._patchLocalStorage();
    this._wireForm();
    this._wireSignOut();
    this._checkExistingSession();
  },

  usernameToEmail(username) {
    return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
  },

  validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  },

  async _checkExistingSession() {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session) {
        await this._onLoginSuccess(data.session.user);
        return;
      }
    } catch (e) {
      /* セッション確認に失敗した場合はログイン画面を表示する */
    }
    this._showAuthScreen();
  },

  _showAuthScreen() {
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("app-header").hidden = true;
    document.getElementById("app-main").hidden = true;
    document.getElementById("app-nav").hidden = true;
  },

  async _onLoginSuccess(user) {
    this.currentUserId = user.id;
    this.currentEmail = user.email;
    this.currentUsername = (user.email || "").split("@")[0];
    await this._hydrateFromCloud();
    await this._pushToCloud(); // 新規登録時に既存のローカル進捗があればクラウドへ反映する

    document.getElementById("auth-screen").hidden = true;
    document.getElementById("app-header").hidden = false;
    document.getElementById("app-main").hidden = false;
    document.getElementById("app-nav").hidden = false;

    if (typeof initApp === "function") initApp();
  },

  async _hydrateFromCloud() {
    try {
      const { data, error } = await supabaseClient
        .from("user_data")
        .select("*")
        .eq("user_id", this.currentUserId)
        .maybeSingle();
      if (error || !data) return;

      this._hydrating = true;
      Object.keys(SYNCED_KEYS).forEach((storageKey) => {
        const val = data[SYNCED_KEYS[storageKey]];
        if (val === null || val === undefined) return;
        const toStore = typeof val === "string" ? val : JSON.stringify(val);
        localStorage.setItem(storageKey, toStore);
      });
      this._hydrating = false;
    } catch (e) {
      /* クラウドからの取得に失敗してもローカルデータで続行できる */
    }
  },

  // localStorage.setItemを差し替え、対象キーへの書き込みをクラウドへも反映する
  // Object.definePropertyで非列挙にし、Object.keys(localStorage)等の既存の使い方に影響を与えないようにする
  _patchLocalStorage() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const self = this;
    Object.defineProperty(localStorage, "setItem", {
      value: function (key, value) {
        originalSetItem(key, value);
        if (self._hydrating) return;
        if (SYNCED_KEYS[key] && self.currentUserId) {
          clearTimeout(self._syncTimer);
          self._syncTimer = setTimeout(() => self._pushToCloud(), 800);
        }
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  },

  async _pushToCloud() {
    if (!this.currentUserId) return;
    const row = { user_id: this.currentUserId, updated_at: new Date().toISOString() };
    Object.keys(SYNCED_KEYS).forEach((storageKey) => {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return;
      let value;
      try {
        value = JSON.parse(raw);
      } catch (e) {
        value = raw; // codetango_home_langはJSON形式ではない単純な文字列のため
      }
      row[SYNCED_KEYS[storageKey]] = value;
    });
    try {
      await supabaseClient.from("user_data").upsert(row, { onConflict: "user_id" });
    } catch (e) {
      /* 同期に失敗してもローカルには保存されているので学習は継続できる */
    }
  },

  async signOut() {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      /* サインアウト自体に失敗してもローカル状態はリセットする */
    }
    Object.keys(SYNCED_KEYS).forEach((k) => localStorage.removeItem(k));
    location.reload();
  },

  // パスワードを再確認したうえでアカウント本体とクラウド上のデータを完全に削除する
  // 戻り値：{ ok: true } または { ok: false, message }
  async deleteAccount(password) {
    if (!this.currentEmail) return { ok: false, message: "ログイン状態が確認できません" };

    const { error: reauthError } = await supabaseClient.auth.signInWithPassword({
      email: this.currentEmail,
      password,
    });
    if (reauthError) return { ok: false, message: "パスワードが正しくありません" };

    const { error: rpcError } = await supabaseClient.rpc("delete_own_account");
    if (rpcError) return { ok: false, message: "削除に失敗しました：" + rpcError.message };

    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      /* アカウント自体は削除済みのため、サインアウトの失敗は無視して続行する */
    }
    Object.keys(SYNCED_KEYS).forEach((k) => localStorage.removeItem(k));
    return { ok: true };
  },

  _wireSignOut() {
    const btn = document.getElementById("auth-signout-btn");
    if (btn) btn.addEventListener("click", () => this.signOut());
  },

  _wireForm() {
    const form = document.getElementById("auth-form");
    const usernameInput = document.getElementById("auth-username");
    const passwordInput = document.getElementById("auth-password");
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("auth-submit-btn");
    const toggleBtn = document.getElementById("auth-toggle-mode-btn");
    const titleEl = document.getElementById("auth-title");
    let mode = "signup"; // "signup" | "signin"

    // モード（サインアップ/サインイン）に応じた文言だけを更新する。エラー表示は別途制御する
    const render = () => {
      titleEl.textContent = mode === "signup" ? "新規アカウント作成" : "サインイン";
      submitBtn.textContent = mode === "signup" ? "アカウントを作成" : "サインイン";
      toggleBtn.textContent =
        mode === "signup" ? "すでにアカウントをお持ちの方はこちら" : "はじめての方はこちら（新規登録）";
    };
    render();

    toggleBtn.addEventListener("click", () => {
      mode = mode === "signup" ? "signin" : "signup";
      errorEl.textContent = "";
      render();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.textContent = "";

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!this.validateUsername(username)) {
        errorEl.textContent = "ユーザー名は半角英数字とアンダースコアで3〜20文字にしてください";
        return;
      }
      if (password.length < 6) {
        errorEl.textContent = "パスワードは6文字以上で設定してください";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "処理中...";
      const email = this.usernameToEmail(username);

      if (mode === "signup") {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
          errorEl.textContent = /registered|exists/i.test(error.message)
            ? "そのユーザー名は既に使われています"
            : "登録に失敗しました：" + error.message;
          submitBtn.disabled = false;
          render();
          return;
        }
        if (data.user) {
          await this._onLoginSuccess(data.user);
        } else {
          errorEl.textContent = "登録に失敗しました。もう一度お試しください";
          submitBtn.disabled = false;
          render();
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          errorEl.textContent = "ユーザー名またはパスワードが正しくありません";
          submitBtn.disabled = false;
          render();
          return;
        }
        if (data.user) await this._onLoginSuccess(data.user);
      }
    });
  },
};

document.addEventListener("DOMContentLoaded", () => Auth.init());
