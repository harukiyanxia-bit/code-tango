// マップの進行状況（各単元のラウンド達成数）を保存する
// 1つの単元をクリアするには ROUNDS_REQUIRED 回のラウンド（1ラウンド=20問）が必要

const MAP_STORAGE_KEY = "codetango_map";
const ROUNDS_REQUIRED = 10;

const MapProgress = {
  rounds: {}, // { python: { basic: 3, func: 0, ... } }
  skipped: {}, // { python: { func: true, ... } } 飛び級で解放した単元

  load() {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      this.rounds = data.rounds || {};
      this.skipped = data.skipped || {};
    } catch (e) {
      // 壊れたデータは無視する
    }
  },

  save() {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ rounds: this.rounds, skipped: this.skipped }));
  },

  roundsCompleted(lang, unitKey) {
    return (this.rounds[lang] && this.rounds[lang][unitKey]) || 0;
  },

  isCleared(lang, unitKey) {
    return this.roundsCompleted(lang, unitKey) >= ROUNDS_REQUIRED;
  },

  // 最初のステージは常に解放。それ以降は直前のステージをクリア、または飛び級していれば解放
  isUnlocked(lang, unitKey) {
    const units = UNITS[lang];
    const idx = units.findIndex((u) => u.key === unitKey);
    if (idx <= 0) return true;
    if (this.skipped[lang] && this.skipped[lang][unitKey]) return true;
    return this.isCleared(lang, units[idx - 1].key);
  },

  completeRound(lang, unitKey) {
    if (!this.rounds[lang]) this.rounds[lang] = {};
    const current = this.rounds[lang][unitKey] || 0;
    this.rounds[lang][unitKey] = Math.min(ROUNDS_REQUIRED, current + 1);
    this.save();
  },

  // 飛び級チャレンジに成功した単元を「解放済み」として記録する
  markSkipped(lang, unitKey) {
    if (!this.skipped[lang]) this.skipped[lang] = {};
    this.skipped[lang][unitKey] = true;
    this.save();
  },
};
