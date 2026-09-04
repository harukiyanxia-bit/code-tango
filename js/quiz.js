// 単語クイズの出題データ・ロジック（バトル画面から利用する）

const ALL_WORDS = Object.keys(WORDS).flatMap((lang) =>
  WORDS[lang].map((w) => ({ ...w, lang }))
);

// pool（出題候補となる単語配列）から1問分の6択クイズを組み立てる
function buildWordQuestion(lang, pool) {
  const langPool = ALL_WORDS.filter((w) => w.lang === lang);
  const target = pool[Math.floor(Math.random() * pool.length)];
  const type = Math.random() < 0.5 ? "term2def" : "def2term";

  // 選択肢は言語全体から集める（単元を絞っても必ず6択そろうように）
  const others = shuffleArray(langPool.filter((w) => w.term !== target.term)).slice(0, 5);

  const correctText = type === "term2def" ? target.def : target.term;
  const distractors = others.map((w) => (type === "term2def" ? w.def : w.term));

  const choiceTexts = shuffleArray([correctText, ...distractors]);
  const correctIndex = choiceTexts.indexOf(correctText);

  return {
    type,
    prompt: type === "term2def" ? target.term : target.def,
    correctText,
    choices: choiceTexts,
    correctIndex,
    lang: target.lang,
    unit: target.unit,
    tier: target.tier,
  };
}
