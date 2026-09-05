// 設定画面（プロフィール・進捗・前回の続き）のレンダリング

const HOME_MODE_LABEL = { quiz: "単語クイズ", order: "並べ替え問題", battle: "マップバトル" };

const HomeEngine = {
  render() {
    document.getElementById("home-username-display").textContent =
      (typeof Auth !== "undefined" && Auth.currentUsername) || "ゲスト";
    document.getElementById("home-level-num").textContent = Progress.level;
    const xpNeeded = Progress.xpForNextLevel();
    document.getElementById("home-xp-fill").style.width = (Progress.xp / xpNeeded) * 100 + "%";
    document.getElementById("home-xp-text").textContent = `${Progress.xp}/${xpNeeded}xp`;
    document.getElementById("home-correct-num").textContent = Progress.correctCount;
    document.getElementById("home-streak-num").textContent = Progress.dayStreak;
    document.getElementById("home-trophy-num").textContent = Progress.trophies;
    this.renderXpChart();
    this.renderContinueCard();
  },

  // 直近7日間の日別獲得XPを折れ線グラフで表示する
  renderXpChart() {
    const days = Progress.last7Days();
    const maxRaw = Math.max(...days.map((d) => d.xp), 0);
    const niceMax = maxRaw === 0 ? 50 : Math.ceil(maxRaw / 50) * 50;

    const width = 560;
    const height = 200;
    const padLeft = 34;
    const padRight = 14;
    const padTop = 16;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const points = days.map((d, i) => {
      const x = padLeft + (days.length === 1 ? 0 : (i / (days.length - 1)) * plotW);
      const y = padTop + plotH - (d.xp / niceMax) * plotH;
      return { x, y, ...d };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
    const yLabelsSvg = yTicks
      .map((v) => {
        const y = padTop + plotH - (v / niceMax) * plotH;
        return `<text x="${padLeft - 8}" y="${y + 4}" font-size="11" fill="#9aa4b6" text-anchor="end">${v}</text>`;
      })
      .join("");

    const xLabelsSvg = points
      .map((p) => `<text x="${p.x}" y="${height - 6}" font-size="11" fill="#6b7280" text-anchor="middle">${p.label}</text>`)
      .join("");

    const circlesSvg = points
      .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#2f6fed" stroke="#fff" stroke-width="1.5"/>`)
      .join("");

    document.getElementById("xp-chart-wrap").innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="xp-chart-svg">
        ${yLabelsSvg}
        <polyline points="${polylinePoints}" fill="none" stroke="#2f6fed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ${circlesSvg}
        ${xLabelsSvg}
      </svg>
    `;
  },

  renderContinueCard() {
    const card = document.getElementById("home-continue-card");
    const session = Progress.lastSession;

    if (!session) {
      card.innerHTML = `
        <div class="home-continue-empty">
          <p>まだ学習履歴がありません。「ホーム」タブから始めましょう！</p>
          <button class="home-continue-btn" id="home-start-btn">はじめる →</button>
        </div>
      `;
      document.getElementById("home-start-btn").addEventListener("click", () => this.goToProblems());
      return;
    }

    const xpNeeded = Progress.xpForNextLevel();
    const pct = (Progress.xp / xpNeeded) * 100;

    card.innerHTML = `
      <div class="home-continue-thumb">${LANG_ICON[session.lang]}</div>
      <div class="home-continue-info">
        <div class="home-continue-meta">${REGION_LABEL[session.lang]} ・ ${HOME_MODE_LABEL[session.mode]}</div>
        <div class="home-continue-title">続きから学習しよう</div>
        <div class="home-continue-progress-row">
          <div class="home-continue-progress-bar"><div class="home-continue-progress-fill" style="width:${pct}%"></div></div>
          <span class="home-continue-progress-text">次のレベルまで ${Progress.xp}/${xpNeeded}xp</span>
        </div>
      </div>
      <button class="home-continue-btn" id="home-continue-btn">続きからはじめる</button>
    `;
    document.getElementById("home-continue-btn").addEventListener("click", () => this.resumeSession(session));
  },

  goToProblems() {
    document.querySelector('.nav-btn[data-screen="home"]').click();
  },

  resumeSession(session) {
    this.goToProblems();
    ProblemFlow.resume(session.mode, session.lang, session.units);
  },
};
