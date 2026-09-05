// 画面切り替え・タブ操作のとりまとめ
// ログイン成功後にauth.jsから呼ばれる（アカウント機能導入により、DOMContentLoaded直後の自動実行はしない）

function initApp() {
  // 下部ナビ（ホーム / 問題 / ランキング / コードを書く / 設定）
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.screen;
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
      document.getElementById("screen-" + target).classList.add("active");

      if (target === "settings") HomeEngine.render();
      if (target === "home") ProblemFlow.renderStage();
      if (target === "problems") QuestEngine.render();
      if (target === "ranking") RankingEngine.render();
    });
  });

  // ホームタブ: 言語切り替え
  document.querySelectorAll(".home-lang-switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => ProblemFlow.selectLanguage(btn.dataset.lang));
  });

  // ホームタブ: バトル画面
  document.getElementById("battle-back").addEventListener("click", () => BattleEngine.endBattle());
  document.getElementById("battle-dont-know").addEventListener("click", () => BattleEngine.selectDontKnow());
  document.getElementById("battle-next").addEventListener("click", () => BattleEngine.handleSubmit());
  document.getElementById("battle-review-btn").addEventListener("click", () => BattleEngine.reviewRound());
  document.getElementById("battle-continue-btn").addEventListener("click", () => BattleEngine.showStreakScreen());
  document.getElementById("streak-continue-btn").addEventListener("click", () => BattleEngine.endBattle());
  document.getElementById("battle-fail-retry-btn").addEventListener("click", () => BattleEngine.retryRound());

  // プレイグラウンドの言語タブ
  document.querySelectorAll(".pg-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".pg-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.pglang;
      document.getElementById("pg-web").style.display = target === "web" ? "block" : "none";
      document.getElementById("pg-python").style.display = target === "python" ? "block" : "none";
    });
  });

  Progress.load();
  MapProgress.load();
  DailyQuest.load();
  ProblemFlow.init();
  BattleEngine.init();
  HomeEngine.render();
  Playground.init();
}
