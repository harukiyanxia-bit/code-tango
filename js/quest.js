// 「クエスト」タブのレンダリング（デイリークエスト一覧）

const QuestEngine = {
  render() {
    DailyQuest.ensureToday();

    const list = document.getElementById("quest-list");
    list.innerHTML = "";

    QUEST_TEMPLATES.forEach((template) => {
      const state = DailyQuest.questState(template);
      const pct = (state.value / state.target) * 100;

      let rewardHtml;
      if (state.claimed) {
        rewardHtml = `
          <span class="quest-claimed-badge">✓ 達成済み
            <span class="quest-claimed-xp">+${template.xp} XP</span>
          </span>
        `;
      } else if (state.complete) {
        rewardHtml = `<button class="quest-claim-btn" data-quest-id="${template.id}">受け取る</button>`;
      } else {
        rewardHtml = `<span class="quest-card-xp">🎁 +${template.xp} XP</span>`;
      }

      const card = document.createElement("div");
      card.className = "quest-card" + (state.claimed ? " claimed" : state.complete ? " ready" : "");
      card.innerHTML = `
        <div class="quest-card-icon">${template.icon}</div>
        <div class="quest-card-body">
          <div class="quest-card-title">${template.title}</div>
          <div class="quest-card-desc">${template.descFn(state.target)}</div>
          <div class="quest-card-progress-row">
            <div class="quest-card-progress-bar"><div class="quest-card-progress-fill" style="width:${pct}%"></div></div>
            <span class="quest-card-progress-text">${state.value} / ${state.target}</span>
          </div>
        </div>
        <div class="quest-card-reward">${rewardHtml}</div>
      `;
      list.appendChild(card);
    });

    document.querySelectorAll(".quest-claim-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        DailyQuest.claim(btn.dataset.questId);
        this.render();
      });
    });

    const total = QUEST_TEMPLATES.length;
    const claimed = DailyQuest.claimedCount();
    document.getElementById("quest-summary-text").textContent = `${claimed} / ${total} 達成`;
    document.getElementById("quest-summary-fill").style.width = (claimed / total) * 100 + "%";
    document.getElementById("quest-complete-banner").hidden = claimed < total;
  },
};
