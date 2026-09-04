// レベル・正解数などの共通進捗管理（単語クイズ・並べ替え問題で共有）
// レベルは言語をまたいで1つに統一し、1からスタートする
// 100レベルに到達するとトロフィーを1つ獲得してレベルは1に戻る
// 次のレベルに必要なXP = (現在のレベル + 1) × LEVEL_XP_FACTOR

const LEVEL_XP_FACTOR = 5; // 次のレベルに必要なXP = (現在レベル+1) × この値
const LEVEL_CAP = 100; // このレベルに到達するとトロフィー獲得＆リセット
const XP_PER_QUIZ_CORRECT = 10; // 単語クイズ1問正解あたりのXP
const XP_PER_ORDER_CORRECT = 20; // 並べ替え問題1問正解あたりのXP
const COMBO_BONUS_PER_STREAK = 5; // 連続正解ボーナス：連続正解数 × この値のXPが追加でもらえる
const SESSION_LENGTH = 20; // 1回の出題セッションあたりの問題数
const PROGRESS_STORAGE_KEY = "codetango_progress";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "YYYY-MM-DD" 形式の今日の日付キー（日別XP・デイリークエストの両方で共有する）
function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const Progress = {
  level: 1,
  xp: 0,
  trophies: 0,
  correctCount: 0,
  streak: 0, // 連続正解数（コンボ）。間違えると0に戻る。デイリークエスト・コンボボーナスXPに利用
  dayStreak: 0, // 連続学習日数（プロフィールの「連続日数」表示に利用）
  lastStreakDate: null, // 連続学習日数を最後に更新した日付（YYYY-MM-DD）
  lastSession: null, // {mode: "quiz"|"order", lang, units: [key...]} 前回の続き用
  dailyXp: {}, // { "YYYY-MM-DD": xp合計, ... } グラフ・クエスト難易度・連続日数カレンダーに利用

  load() {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // 数値項目は不正な形式（オブジェクトなど）が保存されていても壊れないよう数値に丸める
        this.level = Number.isFinite(Number(saved.level)) ? Number(saved.level) : 1;
        this.xp = Number(saved.xp) || 0;
        this.trophies = Number(saved.trophies) || 0;
        this.correctCount = Number(saved.correctCount) || 0;
        this.streak = Number(saved.streak) || 0;
        this.dayStreak = Number(saved.dayStreak) || 0;
        this.lastStreakDate = saved.lastStreakDate || null;
        this.lastSession = saved.lastSession || null;
        this.dailyXp = saved.dailyXp && typeof saved.dailyXp === "object" ? saved.dailyXp : {};
      }
    } catch (e) {
      /* localStorageが使えない環境では初期値のまま進める */
    }
    this.updateUI();
  },

  save() {
    try {
      localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          level: this.level,
          xp: this.xp,
          trophies: this.trophies,
          correctCount: this.correctCount,
          streak: this.streak,
          dayStreak: this.dayStreak,
          lastStreakDate: this.lastStreakDate,
          lastSession: this.lastSession,
          dailyXp: this.dailyXp,
        })
      );
    } catch (e) {
      /* 保存に失敗しても学習は継続できるので無視 */
    }
  },

  setLastSession(mode, lang, units) {
    this.lastSession = { mode, lang, units };
    this.save();
  },

  xpForNextLevel() {
    return (this.level + 1) * LEVEL_XP_FACTOR;
  },

  // 正解時のXPを付与する。戻り値：今回付与されたXP（呼び出し側でのラウンド獲得XP集計に利用）
  registerCorrect(mode) {
    this.correctCount++;
    this.streak++;
    const totalXp = mode === "order" ? XP_PER_ORDER_CORRECT : XP_PER_QUIZ_CORRECT;
    this.addXp(totalXp);
    return totalXp;
  },

  // 問題が全て解き終わった時点の連続正解数 × COMBO_BONUS_PER_STREAK 分のボーナスXPをまとめて付与する
  // 戻り値：付与したボーナスXP（呼び出し側でのラウンド獲得XP集計に利用）
  addComboBonus(comboCount) {
    const bonusXp = comboCount * COMBO_BONUS_PER_STREAK;
    if (bonusXp > 0) this.addXp(bonusXp);
    return bonusXp;
  },

  // 汎用XP付与（デイリークエストの報酬などでも使う）。レベルアップ処理も内包する
  addXp(amount) {
    this.xp += amount;

    while (this.xp >= this.xpForNextLevel()) {
      this.xp -= this.xpForNextLevel();
      this.level++;
      if (this.level > LEVEL_CAP) {
        this.trophies++;
        this.level = 1;
        this.xp = 0;
      }
    }

    this.recordDailyXp(amount);
    this.save();
    this.updateUI();
  },

  // 日別の獲得XPを記録する（グラフ・デイリークエストの難易度調整に利用）
  recordDailyXp(amount) {
    const key = todayDateKey();
    this.dailyXp[key] = (this.dailyXp[key] || 0) + amount;

    // 古いデータを溜め込みすぎないよう直近40日分だけ保持する
    const keys = Object.keys(this.dailyXp).sort();
    while (keys.length > 40) {
      delete this.dailyXp[keys.shift()];
    }
  },

  // 直近7日間（今日を含む）の日別XPを古い日→新しい日の順で返す
  last7Days() {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, xp: this.dailyXp[key] || 0 });
    }
    return days;
  },

  // 直近7日間の1日あたり平均獲得XP（デイリークエストの難易度調整に利用）
  avgXpLast7Days() {
    const days = this.last7Days();
    const total = days.reduce((sum, d) => sum + d.xp, 0);
    return total / days.length;
  },

  registerWrong() {
    this.streak = 0;
    this.save();
    this.updateUI();
  },

  // 問題を解き終えてホームに戻るタイミングで呼び、連続学習日数を更新する
  // 同じ日に複数回呼んでも二重加算しない。前日に学習していれば+1、間が空いていれば1にリセット
  updateDayStreak() {
    const today = todayDateKey();
    if (this.lastStreakDate === today) {
      return { streak: this.dayStreak, updated: false };
    }

    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;

    this.dayStreak = this.lastStreakDate === yesterday ? this.dayStreak + 1 : 1;
    this.lastStreakDate = today;
    this.save();
    this.updateUI();
    return { streak: this.dayStreak, updated: true };
  },

  // 直近7日間（今日を含む）の学習有無を曜日順で返す（連続日数カレンダー表示に利用）
  weekActivity() {
    const dow = ["日", "月", "火", "水", "木", "金", "土"];
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: key, label: dow[d.getDay()], done: (this.dailyXp[key] || 0) > 0, isToday: i === 0 });
    }
    return days;
  },

  allowedTiers() {
    if (this.level <= 2) return ["basic"];
    if (this.level <= 4) return ["basic", "intermediate"];
    return ["basic", "intermediate", "advanced"];
  },

  updateUI() {
    document.getElementById("level-num").textContent = this.level;
    document.getElementById("correct-num").textContent = this.correctCount;
  },
};
