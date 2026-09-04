// 並べ替え問題の出題ロジック（言語・単元選択はProblemFlowが担当し、ここでは並べ替えのみ扱う）

const ORDER_DISTRACTOR_COUNT = 3; // 混ぜる「使わない単語」の数

const OrderEngine = {
  state: {
    lang: null,
    units: new Set(),
    problem: null, // {prompt, correctOrder: [id...], bank: [{id,text}], placed: [{id,text}]}
    answered: false,
    sessionLength: SESSION_LENGTH, // このセッションの出題数
    sessionCount: 0, // このセッションで出した問題数
    sessionCorrect: 0, // このセッションでの正解数
  },

  init() {},

  beginSession(lang, units, sessionLength) {
    this.state.lang = lang;
    this.state.units = new Set(units);
    this.state.sessionLength = sessionLength || SESSION_LENGTH;
    this.state.sessionCount = 0;
    this.state.sessionCorrect = 0;
    document.getElementById("order-play-area").hidden = false;
    setPlayMode(true, "order");
    this.next();
  },

  endSession() {
    document.getElementById("order-play-area").hidden = true;
    setPlayMode(false);
    ProblemFlow.backToUnitsStage();
  },

  // ---------- 出題ロジック ----------

  pickProblem() {
    const { lang, units } = this.state;
    const langPool = ORDER_PROBLEMS[lang];
    const unitPool = langPool.filter((p) => units.has(p.unit));
    const pool = unitPool.length > 0 ? unitPool : langPool; // 選んだ単元に問題がなければ言語全体から出題
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // 「次の問題へ」ボタンから呼ばれる：セッション上限に達していたら結果画面へ
  advance() {
    if (this.state.sessionCount >= this.state.sessionLength) {
      this.showSessionComplete();
      return;
    }
    this.next();
  },

  next() {
    this.state.sessionCount++;

    const def = this.pickProblem();
    const correctTokens = def.tokens.map((text, id) => ({ id, text }));
    const correctTextSet = new Set(def.tokens);

    // 他の問題から「使わない単語」を集めて混ぜる
    const otherTexts = [];
    ORDER_PROBLEMS[this.state.lang].forEach((other) => {
      if (other === def) return;
      other.tokens.forEach((t) => {
        if (!correctTextSet.has(t) && !otherTexts.includes(t)) otherTexts.push(t);
      });
    });
    const distractorTexts = shuffleArray(otherTexts).slice(0, ORDER_DISTRACTOR_COUNT);
    const distractors = distractorTexts.map((text, i) => ({ id: correctTokens.length + i, text }));

    this.state.problem = {
      prompt: def.prompt,
      correctOrder: correctTokens.map((t) => t.id),
      bank: shuffleArray([...correctTokens, ...distractors]),
      placed: [],
    };
    this.state.answered = false;
    document.getElementById("order-question-area").hidden = false;
    document.getElementById("order-session-complete").hidden = true;
    this.render();
  },

  placeToken(id) {
    if (this.state.answered) return;
    const p = this.state.problem;
    const idx = p.bank.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tok] = p.bank.splice(idx, 1);
    p.placed.push(tok);
    this.render();
  },

  removeToken(id) {
    if (this.state.answered) return;
    const p = this.state.problem;
    const idx = p.placed.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [tok] = p.placed.splice(idx, 1);
    p.bank.push(tok);
    this.render();
  },

  render() {
    const p = this.state.problem;
    updatePlayHeader(this.state.sessionCount, this.state.sessionLength);
    document.getElementById("order-prompt").textContent = p.prompt;

    const answerEl = document.getElementById("order-answer");
    answerEl.innerHTML = "";
    answerEl.classList.remove("order-answer-correct", "order-answer-wrong");
    p.placed.forEach((tok) => {
      const btn = document.createElement("button");
      btn.className = "order-token placed";
      btn.textContent = tok.text;
      btn.addEventListener("click", () => this.removeToken(tok.id));
      answerEl.appendChild(btn);
    });

    const bankEl = document.getElementById("order-bank");
    bankEl.innerHTML = "";
    p.bank.forEach((tok) => {
      const btn = document.createElement("button");
      btn.className = "order-token";
      btn.textContent = tok.text;
      btn.addEventListener("click", () => this.placeToken(tok.id));
      bankEl.appendChild(btn);
    });

    const hasPlaced = p.placed.length > 0;
    document.getElementById("order-check").style.display = "inline-block";
    document.getElementById("order-check").disabled = !hasPlaced;
    document.getElementById("order-check-hint").style.display = hasPlaced ? "none" : "block";
    document.getElementById("order-dont-know").style.display = "inline-block";
    document.getElementById("order-dont-know").disabled = false;
    document.getElementById("order-feedback").textContent = "";
    document.getElementById("order-feedback").className = "quiz-feedback";
    document.getElementById("order-correct-line").style.display = "none";
    const nextBtn = document.getElementById("order-next");
    nextBtn.textContent = "次の問題へ →";
    nextBtn.style.display = "none";
  },

  finishQuestion(isCorrect) {
    document.querySelectorAll(".order-token").forEach((el) => (el.disabled = true));
    document.getElementById("order-check").style.display = "none";
    document.getElementById("order-check-hint").style.display = "none";
    document.getElementById("order-dont-know").style.display = "none";

    const nextBtn = document.getElementById("order-next");
    nextBtn.textContent = this.state.sessionCount >= this.state.sessionLength ? "結果を見る →" : "次の問題へ →";
    nextBtn.style.display = "inline-block";

    if (isCorrect) {
      Progress.registerCorrect("order");
    } else {
      Progress.registerWrong();
    }
  },

  showCorrectLine() {
    const p = this.state.problem;
    const allTokens = p.placed.concat(p.bank);
    const correctLine = document.getElementById("order-correct-line");
    correctLine.textContent =
      "正解: " + p.correctOrder.map((id) => allTokens.find((t) => t.id === id).text).join(" ");
    correctLine.style.display = "block";
  },

  check() {
    const p = this.state.problem;
    if (p.placed.length === 0 || this.state.answered) return;
    this.state.answered = true;

    const answerEl = document.getElementById("order-answer");
    const isCorrect =
      p.placed.length === p.correctOrder.length && p.placed.every((t, i) => t.id === p.correctOrder[i]);
    const feedbackEl = document.getElementById("order-feedback");

    if (isCorrect) {
      this.state.sessionCorrect++;
      feedbackEl.textContent = "正解！ 🎉";
      feedbackEl.classList.add("correct");
      answerEl.classList.add("order-answer-correct");
    } else {
      feedbackEl.textContent = "残念、不正解…";
      feedbackEl.classList.add("wrong");
      answerEl.classList.add("order-answer-wrong");
      this.showCorrectLine();
    }

    this.finishQuestion(isCorrect);
  },

  dontKnow() {
    if (this.state.answered) return;
    this.state.answered = true;

    const answerEl = document.getElementById("order-answer");
    answerEl.classList.add("order-answer-wrong");
    const feedbackEl = document.getElementById("order-feedback");
    feedbackEl.textContent = "残念、不正解…";
    feedbackEl.classList.add("wrong");
    this.showCorrectLine();

    this.finishQuestion(false);
  },

  showSessionComplete() {
    document.getElementById("order-session-score").textContent =
      "正解数: " + this.state.sessionCorrect + " / " + this.state.sessionLength;
    document.getElementById("order-question-area").hidden = true;
    document.getElementById("order-session-complete").hidden = false;
  },
};
