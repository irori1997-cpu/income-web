const KEY = "income-portfolio-web-v1";
const CATEGORIES = [
  ["pay", "給与"],
  ["business", "事業"],
  ["invest", "投資"],
  ["property", "不動産"],
  ["pension", "年金"],
  ["other", "その他"],
];
const SEED = {
  goalMonthly: 700000,
  backgroundImage: null,
  sources: [
    { id: "seed-pay", name: "本業の給与", category: "pay", monthlyYen: 480000 },
    { id: "seed-biz", name: "受託", category: "business", monthlyYen: 90000 },
    { id: "seed-div", name: "株式の配当", category: "invest", monthlyYen: 18000 },
    { id: "seed-fund", name: "投信の分配", category: "invest", monthlyYen: 6000 },
  ],
};

const yen = (n) => Math.abs(Math.round(n)).toLocaleString("ja-JP");
const signed = (n) => (n > 0 ? `+${yen(n)}` : n < 0 ? `−${yen(n)}` : yen(0));
const clean = (n) => (!Number.isFinite(n) || n < 0 ? 0 : Math.min(999999999, Math.round(n)));
const labelOf = (id) => CATEGORIES.find((c) => c[0] === id)?.[1] ?? "その他";
const nameOf = (name) => name.trim() || "名称未設定";
const totalOf = (rows) => rows.reduce((sum, row) => sum + clean(row.monthlyYen), 0);
const digits = (raw) =>
  raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/\D/g, "").slice(0, 9);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "");
    if (!saved || !Array.isArray(saved.sources) || saved.sources.length === 0) return structuredClone(SEED);
    saved.goalMonthly = clean(saved.goalMonthly);
    saved.sources = saved.sources
      .filter((row) => row && typeof row.id === "string")
      .map((row) => ({
        id: row.id,
        name: String(row.name || "").slice(0, 40),
        category: CATEGORIES.some((c) => c[0] === row.category) ? row.category : "other",
        monthlyYen: clean(row.monthlyYen),
      }));
    if (!saved.sources.length) return structuredClone(SEED);
    if (typeof saved.backgroundImage !== "string" || !saved.backgroundImage.startsWith("data:image/jpeg")) {
      saved.backgroundImage = null;
    }
    return saved;
  } catch {
    return structuredClone(SEED);
  }
}

let state = load();
let sim = null;
let route = location.hash.replace(/^#/, "") || "/";

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function go(path) {
  location.hash = path;
}

function pie(total, goal) {
  const over = goal > 0 && total > goal;
  const met = goal > 0 && total === goal;
  const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
  const circ = 2 * Math.PI * 82;
  const drawn = (pct / 100) * circ;
  const caption = goal <= 0 ? "目標未設定" : over ? "超過" : met ? "達成" : "目標まで";
  const figure = goal <= 0 ? "—" : over ? yen(total - goal) : met ? "達成" : yen(goal - total);
  return `<div class="card pie" aria-live="polite">
    <div class="pie-wrap">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="82" fill="none" stroke="${goal > 0 ? "var(--mark)" : "var(--line)"}" stroke-width="18"/>
        ${drawn > 0 ? `<circle cx="110" cy="110" r="82" fill="none" stroke="var(--ink)" stroke-width="18" stroke-dasharray="${drawn} ${circ}" transform="rotate(-90 110 110)"/>` : ""}
      </svg>
      <div class="pie-copy">
        <span class="tiny muted">${caption}</span>
        <span class="figure">${figure}</span>
        ${goal > 0 && !met ? `<span class="tiny muted">円</span>` : ""}
      </div>
    </div>
  </div>`;
}

function specs(cells) {
  return `<dl class="card specs">${cells
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
    .join("")}</dl>`;
}

function shell(body, hideNav) {
  const tabs = [
    ["/", "いま"],
    ["/simulate", "試算"],
    ["/settings", "設定"],
  ];
  const link = ([path, text]) =>
    `<a href="#${path}" class="${route === path ? "on" : ""}">${text}</a>`;
  const bg = state.backgroundImage
    ? `<div class="bg" style="background-image:url(${JSON.stringify(state.backgroundImage)})"></div>`
    : "";
  return `${bg}
    <header><div class="bar"><h1>収入ポートフォリオ</h1><nav class="desk" aria-label="メニュー">${tabs.map(link).join("")}</nav></div></header>
    <main>${body}</main>
    ${hideNav ? "" : `<nav class="mobile" aria-label="メニュー"><div class="tabs">${tabs.map(link).join("")}</div></nav>`}`;
}

function dashboard() {
  const total = totalOf(state.sources);
  const items = state.sources
    .map(
      (row) => `<li><a class="card source" href="#/sources/${row.id}">
        <span><span class="truncate">${nameOf(row.name)}</span><span class="tiny muted">${labelOf(row.category)}</span></span>
        <span class="yen">${yen(row.monthlyYen)} <span class="tiny muted">円</span></span>
      </a></li>`,
    )
    .join("");
  return shell(`<h2 class="sr">いまの状況</h2>
    ${pie(total, state.goalMonthly)}
    ${specs([["いま", yen(total)], ["目標", state.goalMonthly > 0 ? yen(state.goalMonthly) : "—"], ["年換算", yen(total * 12)]])}
    <section><div class="row"><h3>収入源</h3><a href="#/sources/new">＋ 追加</a></div><ul class="list">${items}</ul></section>`);
}

function simulate() {
  const rows = sim || state.sources;
  const base = totalOf(state.sources);
  const next = totalOf(rows);
  const delta = next - base;
  const same = JSON.stringify(rows) === JSON.stringify(state.sources);
  const cards = rows
    .map(
      (row, index) => `<li class="card pad" data-i="${index}">
        <div class="end">
          <input class="field" data-name value="${escapeAttr(row.name)}" placeholder="名前" maxlength="40" aria-label="名前" />
          <select data-cat aria-label="区分">${CATEGORIES.map(([id, text]) => `<option value="${id}" ${id === row.category ? "selected" : ""}>${text}</option>`).join("")}</select>
        </div>
        <div class="end gap">
          <input class="field" data-yen inputmode="numeric" value="${row.monthlyYen ? yen(row.monthlyYen) : ""}" aria-label="月額" />
          <span class="muted">円</span>
          <button type="button" class="ghost" data-del ${rows.length <= 1 ? "disabled" : ""}>削除</button>
        </div>
      </li>`,
    )
    .join("");
  return shell(`<h2 class="sr">試算</h2>
    ${pie(next, state.goalMonthly)}
    ${specs([["いま", yen(base)], ["変更後", yen(next)], ["差", signed(delta)]])}
    <div class="row"><h3>試算</h3><button type="button" class="ghost" id="add">＋ 項目を追加</button></div>
    <ul class="list">${cards}</ul>
    <div class="stack" style="margin-top:2rem">
      <button type="button" class="ink-btn" id="apply" ${same ? "disabled" : ""}>反映する</button>
      <button type="button" class="ghost block-ghost" id="discard" ${sim ? "" : "disabled"}>もとに戻す</button>
    </div>`);
}

function settings() {
  return shell(`<div class="card pad">
      <h2>目標月収</h2>
      <div class="end gap"><input id="goal" class="field" inputmode="numeric" value="${state.goalMonthly ? yen(state.goalMonthly) : ""}" aria-label="目標月収" /><span class="muted">円</span></div>
    </div>
    <div class="card pad gap">
      <h2>背景画像</h2>
      ${state.backgroundImage ? `<img alt="いまの背景" src="${state.backgroundImage}" style="margin-top:.75rem;height:7rem;width:100%;object-fit:cover;border-radius:.75rem" />` : ""}
      <label class="ink-btn" style="margin-top:1rem">背景画像を変更<input id="bg" type="file" accept="image/*" class="sr" /></label>
      ${state.backgroundImage ? `<button type="button" class="ghost" id="clear-bg">背景を外す</button>` : `<p class="tiny muted">画像をインポートすると、画面の背景になります。</p>`}
    </div>
    <div class="card pad gap">
      <h2>入れる</h2>
      <button type="button" class="ink-btn" id="install" style="margin-top:1rem">ホーム画面に追加</button>
      <p class="tiny muted" id="install-note">iPhoneは共有ボタンから「ホーム画面に追加」。パソコンはブラウザのインストールです。</p>
    </div>
    <button type="button" class="ghost" id="reset" style="margin-top:4rem">サンプルに戻す</button>`);
}

function formPage(heading, row, id) {
  return shell(
    `<div class="stack">
      <a class="back" href="#/">戻る</a>
      <h2 style="font-size:1.125rem">${heading}</h2>
      <form id="form" class="card pad stack">
        <label>名前<span class="tiny muted"></span><input name="name" class="field" maxlength="40" value="${escapeAttr(row.name)}" placeholder="名前" /></label>
        <label>区分<select name="category" class="field">${CATEGORIES.map(([cid, text]) => `<option value="${cid}" ${cid === row.category ? "selected" : ""}>${text}</option>`).join("")}</select></label>
        <label>月額<div class="end"><input name="yen" class="field" inputmode="numeric" value="${row.monthlyYen ? yen(row.monthlyYen) : ""}" aria-label="月額" /><span class="muted">円</span></div></label>
        <button class="ink-btn" type="submit">${id ? "保存する" : "追加する"}</button>
      </form>
      ${id && state.sources.length > 1 ? `<button type="button" class="ghost" id="remove">削除する</button>` : ""}
    </div>`,
    true,
  );
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/"/g, "\u0026quot;")
    .replace(/</g, "\u0026lt;");
}

function render() {
  route = location.hash.replace(/^#/, "") || "/";
  const root = document.getElementById("app");
  let html = dashboard();
  let title = "いま · 収入ポートフォリオ";
  if (route === "/simulate") {
    html = simulate();
    title = "試算 · 収入ポートフォリオ";
  } else if (route === "/settings") {
    html = settings();
    title = "設定 · 収入ポートフォリオ";
  } else if (route === "/sources/new") {
    html = formPage("収入源を追加", { name: "", category: "other", monthlyYen: 0 });
    title = "収入源を追加 · 収入ポートフォリオ";
  } else if (route.startsWith("/sources/")) {
    const id = decodeURIComponent(route.slice("/sources/".length));
    const row = state.sources.find((item) => item.id === id);
    html = row
      ? formPage("収入源を編集", row, id)
      : shell(`<p>この収入源は見つかりません。</p><a class="back" href="#/">戻る</a>`, true);
    title = "収入源を編集 · 収入ポートフォリオ";
  }
  document.title = title;
  root.innerHTML = html;
  bind();
}

function readYen(input) {
  const value = digits(input.value);
  input.value = value;
  return value ? Number(value) : 0;
}

function bind() {
  document.getElementById("goal")?.addEventListener("change", (event) => {
    state.goalMonthly = readYen(event.target);
    event.target.value = state.goalMonthly ? yen(state.goalMonthly) : "";
    save();
  });
  document.getElementById("clear-bg")?.addEventListener("click", () => {
    state.backgroundImage = null;
    save();
    render();
  });
  document.getElementById("bg")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      state.backgroundImage = canvas.toDataURL("image/jpeg", 0.72);
      save();
      render();
    };
    img.src = url;
  });
  document.getElementById("reset")?.addEventListener("click", () => {
    if (!confirm("サンプルの収入源に戻します。いまの内容は置き換わります。")) return;
    state = { ...structuredClone(SEED), backgroundImage: state.backgroundImage };
    sim = null;
    save();
    render();
  });
  document.getElementById("install")?.addEventListener("click", async () => {
    const note = document.getElementById("install-note");
    if (window.deferredInstall) {
      window.deferredInstall.prompt();
      await window.deferredInstall.userChoice;
      window.deferredInstall = null;
      if (note) note.textContent = "追加しました。";
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (note) {
      note.textContent = ios
        ? "画面下の共有ボタンを押して、「ホーム画面に追加」を選んでください。"
        : "ブラウザのメニューから「インストール」または「ホーム画面に追加」を選んでください。";
    }
  });
  document.getElementById("add")?.addEventListener("click", () => {
    const rows = (sim || state.sources).map((row) => ({ ...row }));
    rows.unshift({ id: crypto.randomUUID(), name: "", category: "other", monthlyYen: 0 });
    sim = rows;
    render();
  });
  document.getElementById("apply")?.addEventListener("click", () => {
    if (!sim || !confirm("この内容で、いまの収入源を置き換えます。")) return;
    state.sources = sim;
    sim = null;
    save();
    render();
  });
  document.getElementById("discard")?.addEventListener("click", () => {
    sim = null;
    render();
  });
  document.querySelectorAll("[data-i]").forEach((card) => {
    const index = Number(card.dataset.i);
    const update = (patch) => {
      const rows = (sim || state.sources).map((row) => ({ ...row }));
      rows[index] = { ...rows[index], ...patch };
      sim = rows;
      render();
    };
    card.querySelector("[data-name]").addEventListener("change", (event) => update({ name: event.target.value.slice(0, 40) }));
    card.querySelector("[data-cat]").addEventListener("change", (event) => update({ category: event.target.value }));
    card.querySelector("[data-yen]").addEventListener("change", (event) => update({ monthlyYen: readYen(event.target) }));
    card.querySelector("[data-del]")?.addEventListener("click", () => {
      const rows = (sim || state.sources).map((row) => ({ ...row }));
      if (rows.length <= 1) return;
      rows.splice(index, 1);
      sim = rows;
      render();
    });
  });
  document.getElementById("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const next = {
      name: String(data.get("name") || "").slice(0, 40),
      category: String(data.get("category") || "other"),
      monthlyYen: digits(String(data.get("yen") || "")) ? Number(digits(String(data.get("yen") || ""))) : 0,
    };
    if (route === "/sources/new") {
      state.sources.push({ id: crypto.randomUUID(), ...next });
    } else {
      const id = decodeURIComponent(route.slice("/sources/".length));
      state.sources = state.sources.map((row) => (row.id === id ? { ...row, ...next } : row));
    }
    save();
    go("/");
  });
  document.getElementById("remove")?.addEventListener("click", () => {
    if (!confirm("この収入源を削除します。")) return;
    const id = decodeURIComponent(route.slice("/sources/".length));
    if (state.sources.length <= 1) return;
    state.sources = state.sources.filter((row) => row.id !== id);
    save();
    go("/");
  });
}

window.addEventListener("hashchange", render);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredInstall = event;
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
render();
