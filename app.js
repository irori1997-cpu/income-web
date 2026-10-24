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

function normalize(saved) {
  if (!saved || !Array.isArray(saved.sources)) return null;
  const sources = saved.sources
    .filter((row) => row && typeof row.id === "string")
    .map((row) => ({
      id: row.id,
      name: String(row.name || "").slice(0, 40),
      category: CATEGORIES.some((c) => c[0] === row.category) ? row.category : "other",
      monthlyYen: clean(row.monthlyYen),
    }));
  const backgroundImage =
    typeof saved.backgroundImage === "string" && saved.backgroundImage.startsWith("data:image/jpeg")
      ? saved.backgroundImage
      : null;
  return { goalMonthly: clean(saved.goalMonthly), backgroundImage, sources };
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY) || "")) || structuredClone(SEED);
  } catch {
    return structuredClone(SEED);
  }
}

let state = load();
let sim = null;
let route = location.hash.replace(/^#/, "") || "/";

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 画像が大きいと端末に残らないことがある。画面には出す。 */
  }
}

function go(path) {
  const next = String(path || "/").replace(/^#/, "") || "/";
  const current = location.hash.replace(/^#/, "") || "/";
  if (current === next) {
    render();
    return;
  }
  const url = new URL(location.href);
  url.hash = next;
  history.pushState(null, "", url);
  render();
}

function pie(total, goal) {
  const inner = 2 * Math.PI * 74;
  const outer = 2 * Math.PI * 96;
  const reached = goal > 0 && total >= goal;
  const progress = goal > 0 ? Math.min(1, total / goal) : 0;
  const extra = goal > 0 ? Math.min(1, Math.max(0, total - goal) / goal) : 0;
  const drawn = progress * inner;
  const extraDrawn = extra * outer;
  const caption = goal <= 0 ? "目標未設定" : reached ? "超過" : "目標まで";
  const figure = goal <= 0 ? "—" : reached ? yen(total - goal) : yen(goal - total);
  const arc = (radius, length, circ, color, width) =>
    length <= 0
      ? ""
      : length >= circ - 0.5
        ? `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${color}" stroke-width="${width}"/>`
        : `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${color}" stroke-width="${width}" stroke-dasharray="${length} ${circ}" transform="rotate(-90 110 110)"/>`;
  return `<div class="card pie" aria-live="polite">
    <div class="pie-wrap">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="74" fill="none" stroke="${goal > 0 ? "var(--mark)" : "var(--line)"}" stroke-width="16"/>
        ${arc(74, drawn, inner, "var(--ink)", 16)}
        ${extra > 0 ? `<circle cx="110" cy="110" r="96" fill="none" stroke="var(--line)" stroke-width="12"/>${arc(96, extraDrawn, outer, "#8e3b34", 12)}` : ""}
      </svg>
      <div class="pie-copy">
        <span class="tiny muted">${caption}</span>
        <span class="figure">${figure}</span>
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
    ? `<div class="bg" aria-hidden="true"><img alt="" src="${state.backgroundImage}" /></div>`
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
      (row) => `<li class="swipe">
        <button type="button" class="swipe-del" data-del-source="${escapeAttr(row.id)}">削除</button>
        <a class="card source" href="#/sources/${row.id}">
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
      ${state.backgroundImage ? `<button type="button" class="ghost" id="clear-bg">背景を外す</button>` : ""}
    </div>
    <div class="card pad gap">
      <h2>データ</h2>
      <button type="button" class="ink-btn" id="export" style="margin-top:1rem">書き出す</button>
      <label class="ink-btn" style="margin-top:0.75rem">読み込む<input id="import" type="file" accept="application/json,.json" class="sr" /></label>
    </div>`);
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
      ${id ? `<button type="button" class="ghost" id="remove">削除する</button>` : ""}
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
    event.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      state.backgroundImage = canvas.toDataURL("image/jpeg", 0.8);
      save();
      render();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("この画像は使えません。");
    };
    img.src = url;
  });
  document.getElementById("export")?.addEventListener("click", () => {
    const blob = new Blob(
      [JSON.stringify({ goalMonthly: state.goalMonthly, sources: state.sources, backgroundImage: state.backgroundImage }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "収入ポートフォリオ.json";
    a.click();
  });
  document.getElementById("import")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = normalize(JSON.parse(await file.text()));
      if (!next) throw new Error("empty");
      if (!confirm("読み込んだ内容で、いまの数字を置き換えます。")) return;
      state = next;
      sim = null;
      save();
      render();
    } catch {
      alert("このファイルは読めません。");
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
    state.sources = state.sources.filter((row) => row.id !== id);
    save();
    go("/");
  });
  document.querySelectorAll(".swipe").forEach((row) => {
    const card = row.querySelector(".source");
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let tracking = false;
    let horizontal = false;
    const width = () => row.querySelector(".swipe-del")?.offsetWidth || 88;
    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      startX = event.clientX;
      startY = event.clientY;
      dx = 0;
      tracking = true;
      horizontal = false;
    });
    card.addEventListener("pointermove", (event) => {
      if (!tracking) return;
      const mx = event.clientX - startX;
      const my = event.clientY - startY;
      if (!horizontal) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx)) {
          tracking = false;
          return;
        }
        horizontal = true;
        card.setPointerCapture?.(event.pointerId);
        card.style.transition = "none";
      }
      dx = mx;
      const base = row.classList.contains("open") ? -width() : 0;
      card.style.transform = `translateX(${Math.min(0, Math.max(-width(), base + mx))}px)`;
    });
    const finish = () => {
      if (!tracking && !horizontal) return;
      tracking = false;
      card.style.transition = "";
      card.style.transform = "";
      if (!horizontal) return;
      card.dataset.swiped = "1";
      setTimeout(() => delete card.dataset.swiped, 400);
      if (dx < -36) {
        document.querySelectorAll(".swipe.open").forEach((other) => other.classList.remove("open"));
        row.classList.add("open");
      } else if (dx > 36) {
        row.classList.remove("open");
      }
      horizontal = false;
      dx = 0;
    };
    card.addEventListener("pointerup", finish);
    card.addEventListener("pointercancel", finish);
  });
  document.querySelectorAll("[data-del-source]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-source");
      state.sources = state.sources.filter((row) => row.id !== id);
      save();
      render();
    });
  });
}

document.addEventListener(
  "click",
  (event) => {
    const a = event.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    if (a.dataset.swiped === "1") {
      event.preventDefault();
      delete a.dataset.swiped;
      return;
    }
    const swipe = a.closest(".swipe");
    if (swipe?.classList.contains("open")) {
      event.preventDefault();
      swipe.classList.remove("open");
      return;
    }
    event.preventDefault();
    go(href);
  },
  true,
);
window.addEventListener("hashchange", render);
window.addEventListener("popstate", render);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredInstall = event;
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
render();
