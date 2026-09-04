// デイリークエスト（1日単位でリセットされる小さな目標。報酬は既存のXP/レベルシステムに還元する）
// 難易度（目標数）は直近7日間の平均獲得XPに応じて変わる（平均が高いほど難しくなる）

const DAILY_QUEST_STORAGE_KEY = "codetango_daily_quest";

const QUEST_TEMPLATES = [
  { id: "answer3", icon: "🌱", title: "はじめの一歩", descFn: (n) => `問題を${n}問解こう`, metric: "answered", target: 3, xp: 30 },
  { id: "streak3", icon: "🎯", title: "正確な一撃", descFn: (n) => `${n}問連続で正解しよう`, metric: "streak", target: 3, xp: 50 },
  { id: "correct3", icon: "📚", title: "復習の旅", descFn: (n) => `${n}問正解しよう`, metric: "correct", target: 3, xp: 40 },
  { id: "answer10", icon: "🔥", title: "Python修行", descFn: (n) => `問題を${n}問解こう`, metric: "answered", target: 10, xp: 100 },
  { id: "round1", icon: "⚡", title: "スピードスター", descFn: (n) => `ラウンドを${n}つクリアしよう`, metric: "round", target: 1, xp: 50 },
];

const DailyQuest = {
  date: null,
  progress: { answered: 0, correct: 0, streak: 0, round: 0 },
  claimed: {}, // { [questId]: true }
  targets: {}, // { [questId]: そのクエストの実際の目標数（その日の難易度で固定） }

  load() {
    const today = todayDateKey();
    let saved = null;
    try {
      const raw = localStorage.getItem(DAILY_QUEST_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      /* 壊れたデータは無視する */
    }

    if (saved && saved.date === today) {
      this.date = today;
      this.progress = Object.assign({ answered: 0, correct: 0, streak: 0, round: 0 }, saved.progress);
      this.claimed = saved.claimed || {};
      this.targets = saved.targets && typeof saved.targets === "object" ? saved.targets : this.computeTargets();
    } else {
      // 日付が変わった、または初回アクセス：その日のクエストとして初期化する
      // 難易度はこの時点（その日の最初のアクセス時）の直近7日平均XPで決め、その日は固定する
      this.date = today;
      this.progress = { answered: 0, correct: 0, streak: 0, round: 0 };
      this.claimed = {};
      this.targets = this.computeTargets();
      this.save();
    }
  },

  save() {
    try {
      localStorage.setItem(
        DAILY_QUEST_STORAGE_KEY,
        JSON.stringify({ date: this.date, progress: this.progress, claimed: this.claimed, targets: this.targets })
      );
    } catch (e) {
      /* 保存に失敗しても学習は継続できるので無視 */
    }
  },

  // 直近7日間の平均獲得XPから難易度倍率を決める（平均が高いほど難しく、最大3倍）
  difficultyMultiplier() {
    const avg = Progress.avgXpLast7Days();
    return Math.min(3, Math.max(1, 1 + avg / 200));
  },

  computeTargets() {
    const mult = this.difficultyMultiplier();
    const targets = {};
    QUEST_TEMPLATES.forEach((t) => {
      targets[t.id] = Math.max(t.target, Math.round(t.target * mult));
    });
    return targets;
  },

  // 日をまたいでいたら記録前にリセットする
  ensureToday() {
    if (this.date !== todayDateKey()) this.load();
  },

  // 問題に1問答えるたびに呼ばれる（正解・不正解・スキップいずれも「解いた」に含める）
  recordAnswer(isCorrect, currentStreak) {
    this.ensureToday();
    this.progress.answered++;
    if (isCorrect) this.progress.correct++;
    if (currentStreak > this.progress.streak) this.progress.streak = currentStreak;
    this.save();
  },

  // ラウンドを1つクリアするたびに呼ばれる
  recordRoundClear() {
    this.ensureToday();
    this.progress.round++;
    this.save();
  },

  questState(template) {
    const target = this.targets[template.id] || template.target;
    const value = Math.min(this.progress[template.metric] || 0, target);
    return {
      value,
      target,
      complete: value >= target,
      claimed: !!this.claimed[template.id],
    };
  },

  claim(id) {
    this.ensureToday();
    const template = QUEST_TEMPLATES.find((q) => q.id === id);
    if (!template) return;
    const state = this.questState(template);
    if (!state.complete || state.claimed) return;
    this.claimed[id] = true;
    this.save();
    Progress.addXp(template.xp);
  },

  claimedCount() {
    this.ensureToday();
    return QUEST_TEMPLATES.filter((t) => this.claimed[t.id]).length;
  },
};
