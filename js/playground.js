// コード実行プレイグラウンド（HTML/CSS/JS はiframeで実行、Pythonはブラウザ内実行）

const PG_STORAGE_KEY = "codetango_playground";

// 全画面切り替え対象のパネル一覧（プレビュー・エディタ共通の仕組みで扱う）
const PG_FULLSCREEN_PANELS = [
  { wrap: "pg-preview-wrap", btn: "pg-fullscreen-btn", exit: "pg-fullscreen-exit-btn" },
  { wrap: "pg-editors-wrap-web", btn: "pg-editor-fullscreen-btn-web", exit: "pg-editor-fullscreen-exit-btn-web" },
  { wrap: "pg-editors-wrap-python", btn: "pg-editor-fullscreen-btn-python", exit: "pg-editor-fullscreen-exit-btn-python" },
];

const Playground = {
  init() {
    this.loadSaved();

    document.getElementById("btn-run-web").addEventListener("click", () => this.runWeb());
    document.getElementById("btn-run-python").addEventListener("click", () => this.runPython());
    document.getElementById("btn-save-web").addEventListener("click", () => this.saveWeb());
    document.getElementById("btn-save-python").addEventListener("click", () => this.savePython());

    PG_FULLSCREEN_PANELS.forEach((panel) => {
      document.getElementById(panel.btn).addEventListener("click", () => this.toggleFullscreenPanel(panel));
      document.getElementById(panel.exit).addEventListener("click", () => this.toggleFullscreenPanel(panel));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      PG_FULLSCREEN_PANELS.forEach((panel) => {
        if (document.getElementById(panel.wrap).classList.contains("pg-fullscreen-panel")) {
          this.toggleFullscreenPanel(panel);
        }
      });
    });

    window.addEventListener("message", (e) => {
      const data = e.data;
      if (!data || !data.__pg) return;
      const out = document.getElementById("pg-console");
      const prefix = data.type === "error" ? "[error] " : "";
      out.textContent += prefix + data.args.join(" ") + "\n";
    });

    this.runWeb();
  },

  // 前回保存したコードをエディタに復元する
  loadSaved() {
    try {
      const raw = localStorage.getItem(PG_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.html === "string") document.getElementById("code-html").value = saved.html;
      if (typeof saved.css === "string") document.getElementById("code-css").value = saved.css;
      if (typeof saved.js === "string") document.getElementById("code-js").value = saved.js;
      if (typeof saved.python === "string") document.getElementById("code-python").value = saved.python;
    } catch (e) {
      /* 保存データが壊れていても初期コードのまま進める */
    }
  },

  // 保存データに部分的なフィールドをマージして保存する（web保存とpython保存で互いを上書きしないようにする）
  persistCode(partial) {
    let saved = {};
    try {
      const raw = localStorage.getItem(PG_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      /* 壊れたデータは無視して上書きする */
    }
    Object.assign(saved, partial);
    try {
      localStorage.setItem(PG_STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 保存に失敗してもコードの実行自体には影響しない */
    }
  },

  saveWeb() {
    this.persistCode({
      html: document.getElementById("code-html").value,
      css: document.getElementById("code-css").value,
      js: document.getElementById("code-js").value,
    });
    this.showSaveStatus("pg-save-status-web");
  },

  savePython() {
    this.persistCode({ python: document.getElementById("code-python").value });
    this.showSaveStatus("pg-save-status-python");
  },

  showSaveStatus(id) {
    const el = document.getElementById(id);
    el.hidden = false;
    clearTimeout(el._pgSaveHideTimer);
    el._pgSaveHideTimer = setTimeout(() => {
      el.hidden = true;
    }, 2000);
  },

  // 指定したパネル（プレビュー／エディタ）の全画面表示をオン/オフする
  toggleFullscreenPanel(panel) {
    const wrap = document.getElementById(panel.wrap);
    const btn = document.getElementById(panel.btn);
    const exitBtn = document.getElementById(panel.exit);
    const isFullscreen = wrap.classList.toggle("pg-fullscreen-panel");
    document.body.classList.toggle("pg-fullscreen-active", isFullscreen);
    btn.textContent = isFullscreen ? "⛶ 閉じる" : "⛶ 全画面";
    exitBtn.hidden = !isFullscreen;
  },

  runWeb() {
    const html = document.getElementById("code-html").value;
    const css = document.getElementById("code-css").value;
    const js = document.getElementById("code-js").value;
    const consoleEl = document.getElementById("pg-console");
    consoleEl.textContent = "";

    const doc = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${css}</style></head>
<body>
${html}
<script>
(function () {
  function send(type, args) {
    parent.postMessage({ __pg: true, type, args: args.map(String) }, "*");
  }
  ["log", "info", "warn", "error"].forEach(function (m) {
    const orig = console[m];
    console[m] = function (...args) {
      send(m, args);
      if (orig) orig.apply(console, args);
    };
  });
  window.onerror = function (msg) {
    send("error", [msg]);
  };
})();
<\/script>
<script>
try {
${js}
} catch (e) {
  parent.postMessage({ __pg: true, type: "error", args: [e.message] }, "*");
}
<\/script>
</body>
</html>`;

    document.getElementById("pg-iframe").srcdoc = doc;
  },

  runPython() {
    const code = document.getElementById("code-python").value;
    const out = document.getElementById("pg-python-console");
    const note = document.getElementById("pg-python-note");
    out.textContent = "";

    if (typeof Sk === "undefined") {
      note.textContent =
        "Python実行エンジンをまだ読み込めていません（インターネット接続を確認して、もう一度「実行する」を押してください）。";
      return;
    }
    note.textContent = "";

    Sk.configure({
      output: (text) => {
        out.textContent += text;
      },
      read: (filename) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][filename] === undefined) {
          throw new Error("ファイルが見つかりません: '" + filename + "'");
        }
        return Sk.builtinFiles["files"][filename];
      },
      __future__: Sk.python3,
    });

    try {
      Sk.importMainWithBody("<stdin>", false, code, true);
    } catch (e) {
      out.textContent += "\nエラー: " + e.toString();
    }
  },
};
