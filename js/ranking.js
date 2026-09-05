// ランキング画面。Supabaseの「leaderboard」ビュー（全ユーザー分の公開ランキング用データ）を参照する。
// 急上昇＝今日の獲得XP順、合計＝総正解数順。

const RankingEngine = {
  mode: "trending", // "trending" | "total"
  _wired: false,

  init() {
    if (this._wired) return;
    this._wired = true;
    document.querySelectorAll(".ranking-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".ranking-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.mode = tab.dataset.ranktab;
        this.render();
      });
    });
  },

  async render() {
    this.init();
    const listEl = document.getElementById("ranking-list");
    listEl.innerHTML = `<p class="ranking-loading">読み込み中...</p>`;

    const scoreKey = this.mode === "trending" ? "today_xp" : "correct_count";
    const unit = this.mode === "trending" ? "XP" : "問";

    try {
      const { data, error } = await supabaseClient
        .from("leaderboard")
        .select("*")
        .order(scoreKey, { ascending: false })
        .limit(50);

      if (error) {
        listEl.innerHTML = `<p class="ranking-empty">ランキングを読み込めませんでした</p>`;
        return;
      }
      if (!data || data.length === 0) {
        listEl.innerHTML = `<p class="ranking-empty">まだランキングデータがありません</p>`;
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      const myUserId = typeof Auth !== "undefined" ? Auth.currentUserId : null;

      listEl.innerHTML = data
        .map((row, i) => {
          const isMe = row.user_id === myUserId;
          const rankLabel = medals[i] || i + 1;
          return `
            <div class="ranking-item${isMe ? " me" : ""}">
              <div class="ranking-rank">${rankLabel}</div>
              <div class="ranking-avatar">🧑‍💻</div>
              <div class="ranking-info">
                <div class="ranking-username">${row.username}</div>
                <div class="ranking-level">Lv. ${row.level}</div>
              </div>
              <div class="ranking-score">${row[scoreKey] || 0}<span class="ranking-score-unit">${unit}</span></div>
            </div>
          `;
        })
        .join("");
    } catch (e) {
      listEl.innerHTML = `<p class="ranking-empty">ランキングを読み込めませんでした</p>`;
    }
  },
};
