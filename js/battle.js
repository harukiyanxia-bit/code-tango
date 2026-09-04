// マップ上のバトル画面（1ラウンド＝20問、ハートは間違えるたびに1減り0で失敗）
// 1つの単元をクリアするには ROUNDS_REQUIRED（mapstate.js）回のラウンドをクリアする必要がある
// 出題は単語クイズ（6択）と並べ替え問題がランダムに混ざる

const ROUND_LENGTH = 20; // 1ラウンドあたりの出題数
const HEARTS_START = 5; // ハートの初期数
const SKIP_HEARTS = 3; // 飛び級チャレンジのハート初期数
const ORDER_QUESTION_RATIO = 0.5; // 並べ替え問題が出る割合
const ORDER_DISTRACTOR_COUNT = 2; // 並べ替え問題に混ぜる「使わない単語」の数

// 並べ替え問題を1問組み立てる（単語クイズのbuildWordQuestionに相当）
function buildOrderQuestion(lang, unitKey) {
  const langPool = ORDER_PROBLEMS[lang];
  const unitPool = langPool.filter((p) => p.unit === unitKey);
  const pool = unitPool.length > 0 ? unitPool : langPool;
  const def = pool[Math.floor(Math.random() * pool.length)];

  const correctTokens = def.tokens.map((text, id) => ({ id, text }));
  const correctTextSet = new Set(def.tokens);

  const otherTexts = [];
  langPool.forEach((other) => {
    if (other === def) return;
    other.tokens.forEach((t) => {
      if (!correctTextSet.has(t) && !otherTexts.includes(t)) otherTexts.push(t);
    });
  });
  const distractorTexts = shuffleArray(otherTexts).slice(0, ORDER_DISTRACTOR_COUNT);
  const distractors = distractorTexts.map((text, i) => ({ id: correctTokens.length + i, text }));

  return {
    kind: "order",
    prompt: def.prompt,
    correctOrder: correctTokens.map((t) => t.id),
    bank: shuffleArray([...correctTokens, ...distractors]),
  };
}

const BattleEngine = {
  state: {
    lang: null,
    unitKey: null,
    stageIndex: 0,
    questionIndex: 0, // 1〜ROUND_LENGTH
    hearts: HEARTS_START,
    current: null,
    selectedIndex: null, // 単語クイズ用
    orderPlaced: [], // 並べ替え問題用：並べた順のトークン
    orderBank: [], // 並べ替え問題用：残りのバンク
    answered: false,
    failed: false,
    isSkip: false, // 飛び級チャレンジ中かどうか
    combo: 0, // 現在の連続正解数（ラウンド内）
    comboMax: 0, // このラウンドで達成した最大コンボ
    correctThisRound: 0,
    xpEarnedThisRound: 0,
    levelAtStart: 1,
    trophiesAtStart: 0,
  },

  init() {},

  start(lang, unitKey, options) {
    const opts = options || {};
    const units = UNITS[lang];
    const stageIndex = units.findIndex((u) => u.key === unitKey);

    this.state.lang = lang;
    this.state.unitKey = unitKey;
    this.state.stageIndex = stageIndex;
    this.state.questionIndex = 0;
    this.state.isSkip = !!opts.skip;
    this.state.hearts = this.state.isSkip ? SKIP_HEARTS : HEARTS_START;
    this.state.failed = false;
    this.state.combo = 0;
    this.state.comboMax = 0;
    this.state.correctThisRound = 0;
    this.state.xpEarnedThisRound = 0;
    this.state.levelAtStart = Progress.level;
    this.state.trophiesAtStart = Progress.trophies;

    Progress.setLastSession("battle", lang, [unitKey]);

    document.getElementById("battle-stage-label").textContent = this.state.isSkip
      ? `⏩ 飛び級チャレンジ ・ ${REGION_LABEL[lang]} ・ ${UNITS[lang][stageIndex].label}`
      : `📚 ${REGION_LABEL[lang]} ・ ${UNITS[lang][stageIndex].label}`;
    document.getElementById("battle-top-bar").hidden = false;
    document.getElementById("battle-bottom-bar").hidden = false;
    document.getElementById("battle-clear").hidden = true;
    document.getElementById("battle-streak-screen").hidden = true;
    document.getElementById("battle-fail").hidden = true;
    document.getElementById("battle-question-area").hidden = false;

    this.nextQuestion();
  },

  renderTopBar() {
    const pct = (this.state.questionIndex / ROUND_LENGTH) * 100;
    document.getElementById("battle-progress-fill").style.width = pct + "%";
    document.getElementById("battle-hearts-num").textContent = this.state.hearts;
  },

  buildQuestion() {
    const { lang, unitKey } = this.state;
    const canOrder = ORDER_PROBLEMS[lang] && ORDER_PROBLEMS[lang].length > 0;

    if (canOrder && Math.random() < ORDER_QUESTION_RATIO) {
      return buildOrderQuestion(lang, unitKey);
    }

    const langPool = ALL_WORDS.filter((w) => w.lang === lang);
    const unitPool = langPool.filter((w) => w.unit === unitKey);
    const pool = unitPool.length > 0 ? unitPool : langPool;

    const tiers = Progress.allowedTiers();
    const tieredPool = pool.filter((w) => tiers.includes(w.tier));
    const targetPool = tieredPool.length > 0 ? tieredPool : pool;

    return { kind: "quiz", ...buildWordQuestion(lang, targetPool) };
  },

  nextQuestion() {
    this.state.questionIndex++;
    this.state.current = this.buildQuestion();
    this.state.selectedIndex = null;
    this.state.orderPlaced = [];
    this.state.orderBank = this.state.current.kind === "order" ? [...this.state.current.bank] : [];
    this.state.answered = false;
    this.render();
  },

  render() {
    const q = this.state.current;
    const isOrder = q.kind === "order";

    document.getElementById("battle-quiz-visual").hidden = isOrder;
    document.getElementById("battle-quiz-divider").hidden = isOrder;
    document.getElementById("battle-choices").hidden = isOrder;
    document.getElementById("battle-order-area").hidden = !isOrder;

    if (isOrder) {
      document.getElementById("battle-question-label").textContent = q.prompt;
      this.renderOrderTokens();
    } else {
      document.getElementById("battle-question-label").textContent =
        q.type === "term2def"
          ? "この単語の説明として正しいものはどれ？"
          : "この説明にあてはまる単語はどれ？";
      document.getElementById("battle-question").innerHTML = q.prompt;

      const choicesEl = document.getElementById("battle-choices");
      choicesEl.innerHTML = "";
      q.choices.forEach((text, i) => {
        const btn = document.createElement("button");
        btn.className = "duo-choice-btn";
        btn.innerHTML = text;
        btn.addEventListener("click", () => this.selectTile(i));
        choicesEl.appendChild(btn);
      });
    }

    document.getElementById("battle-feedback").textContent = "";
    document.getElementById("battle-feedback").className = "quiz-feedback";
    document.getElementById("battle-dont-know").disabled = false;

    const submitBtn = document.getElementById("battle-next");
    submitBtn.textContent = "送信する";
    submitBtn.disabled = true;

    this.renderTopBar();
  },

  // 選択肢のタイルを選ぶ（まだ答え合わせはしない）
  selectTile(index) {
    if (this.state.answered) return;
    this.state.selectedIndex = index;
    document.querySelectorAll("#battle-choices .duo-choice-btn").forEach((btn, i) => {
      btn.classList.toggle("selected", i === index);
    });
    document.getElementById("battle-next").disabled = false;
  },

  // ---------- 並べ替え問題 ----------

  renderOrderTokens() {
    const answerEl = document.getElementById("battle-order-answer");
    answerEl.innerHTML = "";
    answerEl.classList.remove("order-answer-correct", "order-answer-wrong");
    this.state.orderPlaced.forEach((tok) => {
      const btn = document.createElement("button");
      btn.className = "order-token placed";
      btn.textContent = tok.text;
      btn.addEventListener("click", () => this.removeOrderToken(tok.id));
      answerEl.appendChild(btn);
    });

    const bankEl = document.getElementById("battle-order-bank");
    bankEl.innerHTML = "";
    this.state.orderBank.forEach((tok) => {
      const btn = document.createElement("button");
      btn.className = "order-token";
      btn.textContent = tok.text;
      btn.addEventListener("click", () => this.placeOrderToken(tok.id));
      bankEl.appendChild(btn);
    });

    document.getElementById("battle-order-correct-line").hidden = true;
    document.getElementById("battle-next").disabled = this.state.orderPlaced.length === 0;
  },

  placeOrderToken(id) {
    if (this.state.answered) return;
    const idx = this.state.orderBank.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tok] = this.state.orderBank.splice(idx, 1);
    this.state.orderPlaced.push(tok);
    this.renderOrderTokens();
  },

  removeOrderToken(id) {
    if (this.state.answered) return;
    const idx = this.state.orderPlaced.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tok] = this.state.orderPlaced.splice(idx, 1);
    this.state.orderBank.push(tok);
    this.renderOrderTokens();
  },

  showOrderCorrectLine() {
    const q = this.state.current;
    const allTokens = this.state.orderPlaced.concat(this.state.orderBank);
    const line = document.getElementById("battle-order-correct-line");
    line.textContent = "正解: " + q.correctOrder.map((id) => allTokens.find((t) => t.id === id).text).join(" ");
    line.hidden = false;
  },

  submitOrderAnswer() {
    this.state.answered = true;

    const q = this.state.current;
    const placed = this.state.orderPlaced;
    const isCorrect =
      placed.length === q.correctOrder.length && placed.every((t, i) => t.id === q.correctOrder[i]);

    const answerEl = document.getElementById("battle-order-answer");
    const feedbackEl = document.getElementById("battle-feedback");

    if (isCorrect) {
      answerEl.classList.add("order-answer-correct");
      const earnedXp = Progress.registerCorrect("order");
      feedbackEl.textContent = `正解！ +${earnedXp}XP`;
      feedbackEl.classList.add("correct");
      this.state.correctThisRound++;
      this.state.xpEarnedThisRound += earnedXp;
      this.state.combo++;
      if (this.state.combo > this.state.comboMax) this.state.comboMax = this.state.combo;
    } else {
      answerEl.classList.add("order-answer-wrong");
      feedbackEl.textContent = "残念、不正解…";
      feedbackEl.classList.add("wrong");
      Progress.registerWrong();
      this.loseHeart();
      this.state.combo = 0;
      this.showOrderCorrectLine();
    }

    DailyQuest.recordAnswer(isCorrect, Progress.streak);
    this.finishQuestion();
  },

  // ---------- 共通の進行処理 ----------

  // 「送信する」ボタン（答え合わせ前）／「次の問題へ」ボタン（答え合わせ後）を兼ねる
  handleSubmit() {
    if (this.state.answered) {
      this.nextQuestion();
      return;
    }
    if (this.state.current.kind === "order") {
      if (this.state.orderPlaced.length === 0) return;
      this.submitOrderAnswer();
    } else {
      if (this.state.selectedIndex === null) return;
      this.submitAnswer(this.state.selectedIndex);
    }
  },

  submitAnswer(index) {
    this.state.answered = true;

    const q = this.state.current;
    const buttons = document.querySelectorAll("#battle-choices .duo-choice-btn");
    const feedbackEl = document.getElementById("battle-feedback");
    const isCorrect = index === q.correctIndex;

    buttons[q.correctIndex].classList.add("correct");

    if (isCorrect) {
      const earnedXp = Progress.registerCorrect("quiz");
      feedbackEl.textContent = `正解！ +${earnedXp}XP`;
      feedbackEl.classList.add("correct");
      this.state.correctThisRound++;
      this.state.xpEarnedThisRound += earnedXp;
      this.state.combo++;
      if (this.state.combo > this.state.comboMax) this.state.comboMax = this.state.combo;
    } else {
      buttons[index].classList.add("wrong");
      feedbackEl.textContent = "残念、不正解…";
      feedbackEl.classList.add("wrong");
      Progress.registerWrong();
      this.loseHeart();
      this.state.combo = 0;
    }

    DailyQuest.recordAnswer(isCorrect, Progress.streak);
    this.finishQuestion();
  },

  selectDontKnow() {
    if (this.state.answered) return;
    this.state.answered = true;

    const q = this.state.current;
    const feedbackEl = document.getElementById("battle-feedback");

    if (q.kind === "order") {
      document.getElementById("battle-order-answer").classList.add("order-answer-wrong");
      feedbackEl.textContent = "残念、不正解…";
      feedbackEl.classList.add("wrong");
      this.showOrderCorrectLine();
    } else {
      const buttons = document.querySelectorAll("#battle-choices .duo-choice-btn");
      buttons[q.correctIndex].classList.add("correct");
      feedbackEl.textContent = "正解は「" + q.correctText + "」でした";
      feedbackEl.classList.add("wrong");
    }

    Progress.registerWrong();
    this.loseHeart();
    this.state.combo = 0;
    DailyQuest.recordAnswer(false, Progress.streak);
    this.finishQuestion();
  },

  loseHeart() {
    this.state.hearts = Math.max(0, this.state.hearts - 1);
    document.getElementById("battle-hearts-num").textContent = this.state.hearts;
    if (this.state.hearts <= 0) this.state.failed = true;
  },

  finishQuestion() {
    document
      .querySelectorAll("#battle-choices .duo-choice-btn, #battle-order-bank .order-token, #battle-order-answer .order-token")
      .forEach((b) => (b.disabled = true));
    document.getElementById("battle-dont-know").disabled = true;

    const submitBtn = document.getElementById("battle-next");

    if (this.state.failed) {
      submitBtn.disabled = true;
      setTimeout(() => this.showFail(), 600);
      return;
    }

    if (this.state.questionIndex >= ROUND_LENGTH) {
      MapProgress.completeRound(this.state.lang, this.state.unitKey);
      if (this.state.isSkip) MapProgress.markSkipped(this.state.lang, this.state.unitKey);
      DailyQuest.recordRoundClear();
      this.state.xpEarnedThisRound += Progress.addComboBonus(this.state.combo);
      submitBtn.disabled = true;
      setTimeout(() => this.showClear(), 600);
      return;
    }

    submitBtn.textContent = "次の問題へ →";
    submitBtn.disabled = false;
  },

  showClear() {
    document.getElementById("battle-question-area").hidden = true;
    document.getElementById("battle-top-bar").hidden = true;
    document.getElementById("battle-bottom-bar").hidden = true;

    const { lang, unitKey } = this.state;
    const cleared = MapProgress.isCleared(lang, unitKey);
    if (this.state.isSkip) {
      document.getElementById("battle-clear-title").textContent = "🎉 飛び級成功！";
      document.getElementById("battle-clear-score").textContent =
        `${UNITS[lang][this.state.stageIndex].label}ステージが解放されました`;
    } else {
      document.getElementById("battle-clear-title").textContent = cleared ? "🎉 ステージクリア！" : "✅ ラウンドクリア！";
      document.getElementById("battle-clear-score").textContent = cleared
        ? "次のステージが解放されました"
        : `進捗: ${MapProgress.roundsCompleted(lang, unitKey)} / ${ROUNDS_REQUIRED} ラウンド`;
    }

    const accuracy = Math.round((this.state.correctThisRound / ROUND_LENGTH) * 100);
    document.getElementById("clear-stat-combo").textContent = this.state.comboMax;
    document.getElementById("clear-stat-accuracy").textContent = accuracy + "%";
    document.getElementById("clear-stat-xp").textContent = "+" + this.state.xpEarnedThisRound;

    const leveledUp = Progress.level > this.state.levelAtStart || Progress.trophies > this.state.trophiesAtStart;
    const levelUpBanner = document.getElementById("level-up-banner");
    if (leveledUp) {
      document.getElementById("level-up-from").textContent = this.state.levelAtStart;
      document.getElementById("level-up-to").textContent = Progress.level;
      levelUpBanner.hidden = false;
    } else {
      levelUpBanner.hidden = true;
    }

    document.getElementById("battle-clear").hidden = false;
  },

  // ステージクリア画面の「マップに戻る」を押した時に、連続学習日数の更新を見せる画面
  showStreakScreen() {
    document.getElementById("battle-clear").hidden = true;

    const { streak, updated } = Progress.updateDayStreak();
    document.getElementById("streak-count-num").textContent = streak;

    const week = Progress.weekActivity();
    document.getElementById("streak-week-row").innerHTML = week
      .map(
        (d) => `
          <div class="streak-day-col">
            <div class="streak-day-circle ${d.done ? "done" : ""} ${d.isToday ? "today" : ""}">${d.done ? "✔" : ""}</div>
            <span class="streak-day-label">${d.label}</span>
          </div>
        `
      )
      .join("");

    document.getElementById("streak-encourage-text").textContent = updated
      ? "がんばって目標を達成しているね。その調子！"
      : "今日の記録はすでに達成済み！また明日も挑戦しよう";

    document.getElementById("battle-streak-screen").hidden = false;
  },

  showFail() {
    document.getElementById("battle-question-area").hidden = true;
    document.getElementById("battle-top-bar").hidden = true;
    document.getElementById("battle-bottom-bar").hidden = true;
    document.getElementById("battle-fail").hidden = false;
  },

  retryRound() {
    this.start(this.state.lang, this.state.unitKey, { skip: this.state.isSkip });
  },

  // クリア後もそのステージの問題を復習として何度でも解けるようにする
  reviewRound() {
    this.start(this.state.lang, this.state.unitKey);
  },

  endBattle() {
    ProblemFlow.backToMapStage();
  },
};
