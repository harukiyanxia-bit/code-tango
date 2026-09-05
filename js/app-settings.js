// アプリ設定画面（表示・サウンド・学習・データ・アプリについて）
// ダークモード/アニメーション/効果音は実際に機能する。
// ヒント・解説・間違いを復習は、現時点ではON/OFFの保存のみ行う
// （実際にヒントや解説を表示する機能自体は別途実装が必要）。

const APP_SETTINGS_STORAGE_KEY = "codetango_app_settings";

const DEFAULT_APP_SETTINGS = {
  darkMode: false,
  animations: true,
  sound: true,
  hints: true,
  explanations: true,
  reviewMistakes: true,
};

const AppSettings = {
  values: { ...DEFAULT_APP_SETTINGS },
  _audioCtx: null,

  init() {
    this.load();
    this.applyDarkMode();
    this.applyAnimations();
    this._wireToggles();
    this._wirePanelNav();
    this._wireAbout();
    this._wireFeedback();
    this._wireDeleteAccount();
  },

  load() {
    try {
      const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
      if (raw) this.values = Object.assign({ ...DEFAULT_APP_SETTINGS }, JSON.parse(raw));
    } catch (e) {
      /* 壊れたデータはデフォルト設定のまま進める */
    }
  },

  save() {
    try {
      localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(this.values));
    } catch (e) {
      /* 保存に失敗しても設定はメモリ上で有効なまま */
    }
  },

  applyDarkMode() {
    document.documentElement.setAttribute("data-theme", this.values.darkMode ? "dark" : "light");
  },

  applyAnimations() {
    document.documentElement.classList.toggle("no-animations", !this.values.animations);
  },

  // 効果音（Web Audio APIで簡易的な音を生成する。音声ファイルは使用しない）
  playSound(type) {
    if (!this.values.sound) return;
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      if (type === "correct") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
      }
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      /* 効果音の再生に失敗しても学習には影響しない */
    }
  },

  _wireToggles() {
    const map = {
      "setting-dark-mode": "darkMode",
      "setting-animations": "animations",
      "setting-sound": "sound",
      "setting-hints": "hints",
      "setting-explanations": "explanations",
      "setting-review-mistakes": "reviewMistakes",
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      const key = map[id];
      el.checked = !!this.values[key];
      el.addEventListener("change", () => {
        this.values[key] = el.checked;
        this.save();
        if (key === "darkMode") this.applyDarkMode();
        if (key === "animations") this.applyAnimations();
      });
    });
  },

  _wirePanelNav() {
    document.getElementById("settings-open-btn").addEventListener("click", () => {
      document.getElementById("settings-overview-panel").hidden = true;
      document.getElementById("settings-app-panel").hidden = false;
    });
    document.getElementById("settings-back-btn").addEventListener("click", () => {
      document.getElementById("settings-app-panel").hidden = true;
      document.getElementById("settings-overview-panel").hidden = false;
    });
  },

  _wireAbout() {
    document.getElementById("settings-about-btn").addEventListener("click", () => {
      document.getElementById("about-modal").hidden = false;
    });
    document.getElementById("about-close-btn").addEventListener("click", () => {
      document.getElementById("about-modal").hidden = true;
    });
  },

  _wireFeedback() {
    document.getElementById("settings-feedback-btn").addEventListener("click", () => {
      alert("フィードバック機能は準備中です。今後のアップデートをお待ちください。");
    });
  },

  _wireDeleteAccount() {
    const modal = document.getElementById("delete-account-modal");
    const passwordInput = document.getElementById("delete-account-password");
    const errorEl = document.getElementById("delete-account-error");
    const confirmBtn = document.getElementById("delete-account-confirm-btn");

    document.getElementById("settings-delete-account-btn").addEventListener("click", () => {
      passwordInput.value = "";
      errorEl.textContent = "";
      modal.hidden = false;
    });

    document.getElementById("delete-account-cancel-btn").addEventListener("click", () => {
      modal.hidden = true;
    });

    confirmBtn.addEventListener("click", async () => {
      errorEl.textContent = "";
      const password = passwordInput.value;
      if (!password) {
        errorEl.textContent = "パスワードを入力してください";
        return;
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = "削除中...";

      const result = await Auth.deleteAccount(password);
      if (!result.ok) {
        errorEl.textContent = result.message;
        confirmBtn.disabled = false;
        confirmBtn.textContent = "削除する";
        return;
      }
      location.reload();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => AppSettings.init());
