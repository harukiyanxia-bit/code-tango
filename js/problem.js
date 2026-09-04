// ホーム画面の異世界マップ制御（言語切り替え → マップ → バトル）

const HOME_LANG_STORAGE_KEY = "codetango_home_lang";

// ステージカードのマーク（統一された線画アイコン）
const STAGE_ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5-13-7.5Z"/></svg>`,
};

const ProblemFlow = {
  state: {
    stage: "map", // "map" | "battle"
    lang: "python",
  },

  init() {
    const saved = localStorage.getItem(HOME_LANG_STORAGE_KEY);
    if (saved && LANG_LABELS[saved]) this.state.lang = saved;
    this.renderStage();
  },

  selectLanguage(lang) {
    this.state.lang = lang;
    this.state.stage = "map";
    localStorage.setItem(HOME_LANG_STORAGE_KEY, lang);
    this.renderStage();
  },

  backToMapStage() {
    this.state.stage = "map";
    this.renderStage();
  },

  enterBattle(lang, unitKey) {
    this.state.stage = "battle";
    this.renderStage();
    BattleEngine.start(lang, unitKey);
  },

  // 1つ上のステージへの飛び級チャレンジ（同じ問題・ハート3で挑戦）
  enterSkipBattle(lang, unitKey) {
    this.state.stage = "battle";
    this.renderStage();
    BattleEngine.start(lang, unitKey, { skip: true });
  },

  // ホーム画面「前回の続き」から再開する
  resume(mode, lang, units) {
    this.selectLanguage(lang);
    if (mode === "battle" && units && units[0] && UNITS[lang].some((u) => u.key === units[0])) {
      this.enterBattle(lang, units[0]);
    }
  },

  renderStage() {
    document.getElementById("home-map-panel").hidden = this.state.stage !== "map";
    document.getElementById("home-battle-panel").hidden = this.state.stage !== "battle";

    document.querySelectorAll(".home-lang-switch-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === this.state.lang);
    });

    if (this.state.stage === "map") this.renderMap();
  },

  renderMap() {
    const lang = this.state.lang;

    const banner = document.getElementById("home-path-banner");
    banner.dataset.lang = lang;
    document.getElementById("home-path-banner-title").textContent = `${LANG_ICON[lang]} ${REGION_LABEL[lang]}`;

    const path = document.getElementById("map-path");
    path.innerHTML = "";

    const units = UNITS[lang];
    // 解放済みの一番先のステージを探し、その1つ上だけ飛び級を許可する（飛び級後はさらにその先も対象になる）
    let lastUnlockedIndex = -1;
    units.forEach((u, i) => {
      if (MapProgress.isUnlocked(lang, u.key)) lastUnlockedIndex = i;
    });
    const skipTargetIndex = lastUnlockedIndex + 1;

    units.forEach((u, i) => {
      const cleared = MapProgress.isCleared(lang, u.key);
      const unlocked = MapProgress.isUnlocked(lang, u.key);
      const rounds = MapProgress.roundsCompleted(lang, u.key);
      const state = cleared ? "cleared" : unlocked ? "current" : "locked";
      const icon = state === "cleared" ? STAGE_ICONS.check : state === "current" ? STAGE_ICONS.play : STAGE_ICONS.lock;
      const canSkip = state === "locked" && i === skipTargetIndex;

      const card = document.createElement("div");
      card.className = "stage-card " + state;
      card.innerHTML = `
        <div class="stage-node">${icon}</div>
        <div class="stage-card-info">
          <span class="stage-card-number">ステージ ${i + 1}</span>
          <span class="stage-card-title">${u.label}</span>
          ${
            state === "current"
              ? `<div class="stage-progress-mini">
                   <div class="stage-progress-mini-bar"><div class="stage-progress-mini-fill" style="width:${(rounds / ROUNDS_REQUIRED) * 100}%"></div></div>
                   <span class="stage-progress-mini-text">${rounds} / ${ROUNDS_REQUIRED}</span>
                 </div>`
              : ""
          }
          ${state === "locked" ? `<span class="stage-card-condition">前のステージをクリアで解放</span>` : ""}
        </div>
        ${state === "current" ? `<span class="stage-start-btn">START</span>` : ""}
        ${state === "cleared" ? `<span class="stage-start-btn stage-review-btn">🔁 復習する</span>` : ""}
        ${canSkip ? `<button class="stage-skip-btn" type="button">⏩ 飛び級</button>` : ""}
      `;
      if (state === "current" || state === "cleared") {
        card.addEventListener("click", () => this.enterBattle(lang, u.key));
      }
      if (canSkip) {
        card.querySelector(".stage-skip-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          this.enterSkipBattle(lang, u.key);
        });
      }
      path.appendChild(card);

      if (i < units.length - 1) {
        const connector = document.createElement("div");
        connector.className = "stage-connector" + (cleared ? " done" : "");
        path.appendChild(connector);
      }
    });
  },
};
