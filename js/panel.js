// SEO Analyzer — lógica del panel lateral.
const H1_MAX = 70; // caracteres recomendados para el H1

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const svg = (paths) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = paths;
  return s;
};
const ICON = {
  ok: '<path d="M20 6 9 17l-5-5"/>',
  warn: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  bang: '<path d="M12 6v7M12 17.5v.01"/>',
  bigBang: '<path d="M12 5.5v8.5M12 18.5v.01"/>',
  check: '<path d="m6 12.5 4 4 8-9"/>',
  minus: '<path d="M7 12h10"/>',
  info: '<path d="M12 11v6M12 7.5v.01"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
};

const state = { seqShowHidden: false, tabId: null, topFrameId: 0, main: [], iframes: [], issueCursor: new Map(), allCollapsed: false };

// ---------- Utilidades de Chrome ----------
const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const RESTRICTED = /chrome:\/\/|chrome-extension:|extensions gallery|webstore|edge:\/\/|about:/i;

// ---------- Acciones ----------
async function analyze() {
  const tab = await getActiveTab();
  if (!tab) return;
  setLoading(true);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["js/content.js"],
    });
    handleResults(tab.id, results);
  } catch (err) {
    await showError(err);
  } finally {
    setLoading(false);
  }
}

async function clearPage() {
  const tab = await getActiveTab();
  showEmpty();
  state.tabId = null;
  if (!tab) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["js/unhighlight.js"],
    });
  } catch (err) { /* nada que limpiar */ }
}

async function locate(frameId, index) {
  if (state.tabId == null) return;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: state.tabId, frameIds: [frameId] },
      args: [index],
      func: (i) => {
        const find = (root) => {
          const hit = root.querySelector(`[data-kr-i="${i}"]`);
          if (hit) return hit;
          for (const n of root.querySelectorAll("*")) {
            if (n.shadowRoot) { const r = find(n.shadowRoot); if (r) return r; }
          }
          return null;
        };
        const target = find(document);
        if (!target) return false;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.animate(
          [
            { boxShadow: "0 0 0 0 rgba(57,255,20,.9)" },
            { boxShadow: "0 0 0 10px rgba(57,255,20,0)" },
          ],
          { duration: 900, iterations: 2, easing: "ease-out" },
        );
        return true;
      },
    });
    if (!res || !res.result) showStale("La página cambió desde el último análisis.");
  } catch (err) {
    showStale("No se pudo ubicar el encabezado. Analiza de nuevo.");
  }
}

// ---------- Análisis ----------
function handleResults(tabId, results) {
  const frames = (results || [])
    .filter((r) => r && r.result)
    .map((r) => ({ frameId: r.frameId, ...r.result }));
  const top = frames.find((f) => f.isTop) || { frameId: 0, headings: [], url: "", title: "" };

  state.tabId = tabId;
  state.navigated = false;
  state.topFrameId = top.frameId;
  state.main = top.headings.map((h) => ({ ...h, frameId: top.frameId }));
  state.iframes = frames
    .filter((f) => !f.isTop && f.headings.length)
    .map((f) => ({ url: f.url, headings: f.headings.map((h) => ({ ...h, frameId: f.frameId })) }));
  state.issueCursor.clear();

  hideStale();
  renderPageInfo(top);
  if (!state.main.length && !state.iframes.length) {
    showEmpty("No se encontraron encabezados", "Esta página no tiene etiquetas H1–H6.");
    return;
  }
  const issues = checkIssues(state.main);
  $("emptyState").hidden = true;
  $("results").hidden = false;
  renderStatus(issues);
  renderCounts(state.main);
  renderSequence(state.main);
  renderIssues(issues);
  renderTree();
}

function checkIssues(list) {
  const issues = [];
  const h1s = list.filter((h) => h.tag === "H1");
  const refs = (arr) => arr.map((h) => ({ frameId: h.frameId, i: h.i }));

  if (h1s.length === 0) {
    issues.push({ sev: "error", title: "No se encontró ningún H1", desc: "La página debería tener un único H1 que describa el tema principal." });
  } else if (h1s.length > 1) {
    issues.push({ sev: "error", title: `Hay ${h1s.length} H1 en la página`, desc: "Deja un solo H1 y convierte los demás en H2.", targets: refs(h1s) });
  }

  const hiddenH1 = h1s.filter((h) => h.hidden);
  if (hiddenH1.length) {
    issues.push({ sev: "warn", title: "El H1 no es visible", desc: "Está oculto con CSS. Google puede darle menos peso que a un H1 visible.", targets: refs(hiddenH1) });
  }

  const longH1 = h1s.filter((h) => h.text.length > H1_MAX);
  if (longH1.length) {
    issues.push({ sev: "warn", title: `H1 demasiado largo (${longH1[0].text.length} caracteres)`, desc: `Intenta dejarlo en menos de ${H1_MAX} caracteres.`, targets: refs(longH1) });
  }

  const skips = [];
  let prev = 0;
  list.forEach((h) => {
    const lvl = +h.tag[1];
    if (prev && lvl > prev + 1) { h.skipFrom = prev; skips.push(h); }
    prev = lvl;
  });
  if (skips.length) {
    const ex = skips[0];
    issues.push({
      sev: "warn",
      title: skips.length === 1 ? "1 salto de nivel" : `${skips.length} saltos de nivel`,
      desc: `Por ejemplo H${ex.skipFrom} → ${ex.tag}. Usa niveles consecutivos para que la jerarquía sea clara.`,
      targets: refs(skips),
    });
  }

  const empty = list.filter((h) => !h.text);
  if (empty.length) {
    issues.push({ sev: "warn", title: empty.length === 1 ? "1 encabezado vacío" : `${empty.length} encabezados vacíos`, desc: "No tienen texto. Complétalos o cambia la etiqueta.", targets: refs(empty) });
  }
  const hiddenOther = list.filter((h) => h.hidden && h.tag !== "H1");
  if (hiddenOther.length) {
    issues.push({
      sev: "info",
      title: hiddenOther.length === 1 ? "1 encabezado oculto" : `${hiddenOther.length} encabezados ocultos`,
      desc: "Están en el código pero no se ven, por ejemplo en menús, pestañas o sliders. No es un error; solo revisa que no sean títulos importantes.",
    });
  }

  return issues;
}

// ---------- Render ----------
function renderPageInfo(top) {
  let where = top.url || "";
  try { const u = new URL(top.url); where = u.host + (u.pathname === "/" ? "" : u.pathname) + u.search; } catch (e) {}
  state.pageUrl = top.url || "";
  $("pageUrl").textContent = where || "Encabezados H1–H6";
  $("pageUrl").title = top.url || "";
  $("pageTitle").textContent = top.title || where || "Estructura de encabezados";
  $("copyUrlBtn").hidden = !top.url;
  state.analyzedAt = Date.now();
  updateLastRun();
}

function resetPageInfo() {
  state.pageUrl = "";
  state.analyzedAt = null;
  $("pageUrl").textContent = "Encabezados H1–H6";
  $("pageUrl").title = "";
  $("pageTitle").textContent = "Estructura de encabezados";
  $("copyUrlBtn").hidden = true;
  updateLastRun();
}

function updateLastRun() {
  const node = $("lastRun");
  if (!state.analyzedAt) { node.hidden = true; return; }
  const min = Math.floor((Date.now() - state.analyzedAt) / 60000);
  let when;
  if (min < 1) when = "ahora mismo";
  else if (min < 60) when = `hace ${min} min`;
  else when = "a las " + new Date(state.analyzedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  node.textContent = `Último análisis: ${when}`;
  node.hidden = false;
}

function renderStatus(issues) {
  const box = $("verdict");
  const errors = issues.filter((i) => i.sev === "error").length;
  const warns = issues.filter((i) => i.sev === "warn").length;
  const problems = issues.filter((i) => i.sev !== "info");
  const kind = errors ? "error" : warns ? "warn" : "ok";
  const word = { ok: "Correcto", warn: "Revisar", error: "Crítico" }[kind];
  const note = problems.length ? problems[0].title + "." : "La jerarquía de encabezados está bien planteada.";

  box.className = `card verdict ${kind}`;
  box.textContent = "";
  const ring = el("div", "ring");
  ring.append(svg(kind === "ok" ? ICON.check : ICON.bigBang));
  const main = el("div");
  main.append(el("div", "eyebrow", "Diagnóstico de encabezados"), el("div", "verdict-word", word), el("p", "verdict-note", note));

  const sum = el(problems.length ? "button" : "div", "verdict-sum");
  const txt = el("div");
  const parts = [];
  if (errors) parts.push(`${errors} error${errors === 1 ? "" : "es"}`);
  if (warns) parts.push(`${warns} aviso${warns === 1 ? "" : "s"}`);
  txt.append(
    el("div", "eyebrow", "Resumen"),
    el("div", "sum-main", parts.length ? parts.join(" · ") : "Sin problemas"),
    el("div", "sum-sub", problems.length ? "Revisa la lista de problemas para corregirlos." : "No hay nada que corregir."),
  );
  sum.append(txt);
  if (problems.length) {
    sum.type = "button";
    sum.append(svg(ICON.chevronRight));
    sum.addEventListener("click", () => {
      const target = $("issuesBlock");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.remove("flash"); void target.offsetWidth; target.classList.add("flash");
    });
  }
  box.append(ring, main, sum);
  renderPromo(kind, problems.length);
}

// Mensaje de la tarjeta de KickRanking según el diagnóstico.
function renderPromo(kind, count) {
  const copy = {
    error: ["¿Te ayudamos a corregirlo?", `Encontramos ${count} ${count === 1 ? "problema" : "problemas"} en esta página. En KickRanking los corregimos y hacemos que tu sitio suba en Google.`],
    warn: ["Tu página puede rendir más", "Hay detalles por pulir. En KickRanking optimizamos tu estructura y tu contenido para posicionar mejor."],
    ok: ["¡Buena estructura! ¿Vamos por más?", "Los encabezados son solo el comienzo. En KickRanking llevamos tu SEO al siguiente nivel."],
    idle: ["¿Necesitas ayuda con tu SEO?", "Somos la agencia detrás de esta herramienta. Te ayudamos a corregir tu sitio y a posicionarlo en Google."],
  }[kind] || null;
  if (!copy) return;
  $("promoTitle").textContent = copy[0];
  $("promoText").textContent = copy[1];
  $("promoLink").href = `https://kickranking.com/?utm_source=seo-analyzer&utm_medium=extension&utm_campaign=panel-cta&utm_content=${kind}`;
}

function renderCounts(list) {
  const box = $("counts");
  box.textContent = "";
  const hidden = list.filter((h) => h.hidden).length;
  $("countsSub").textContent = `${list.length} encabezado${list.length === 1 ? "" : "s"} en total` + (hidden ? ` · ${hidden} no se ven en pantalla` : "");

  for (let lvl = 1; lvl <= 6; lvl++) {
    const items = list.filter((h) => h.tag === "H" + lvl);
    const n = items.length;
    let kind, note;
    if (lvl === 1) {
      if (n === 0) { kind = "error"; note = "Falta el H1"; }
      else if (n > 1) { kind = "error"; note = "Debería haber 1"; }
      else if (items[0].hidden) { kind = "warn"; note = "No se ve"; }
      else if (items[0].text.length > H1_MAX) { kind = "warn"; note = "Muy largo"; }
      else { kind = "ok"; note = "Correcto"; }
    } else if (n === 0) { kind = "none"; note = "Sin usar"; }
    else if (items.some((h) => h.skipFrom)) { kind = "warn"; note = "Salta un nivel"; }
    else if (items.some((h) => !h.text)) { kind = "warn"; note = "Hay vacíos"; }
    else { kind = "ok"; note = "Correcto"; }

    const cell = el("div", `level ${kind}`);
    cell.setAttribute("role", "listitem");
    cell.title = `${n} encabezado${n === 1 ? "" : "s"} H${lvl} · ${note}`;
    const icon = el("span", "level-icon");
    icon.append(svg(kind === "ok" ? ICON.check : kind === "none" ? ICON.minus : ICON.bang));
    cell.append(el("div", "level-tag", "H" + lvl), icon, el("div", "level-num", String(n)), el("div", "level-note", note));
    box.append(cell);
  }
}

function describeSequence(list) {
  if (!list.length) return "La página principal no tiene encabezados; solo hay dentro de iframes.";
  const parts = [];
  const h1s = list.filter((h) => h.tag === "H1").length;
  parts.push(`La página tiene ${list.length} encabezado${list.length === 1 ? "" : "s"} y empieza con un ${list[0].tag}.`);
  if (!h1s) parts.push("No tiene título principal (H1).");
  else if (h1s > 1) parts.push(`Tiene ${h1s} títulos principales (H1); debería tener uno.`);
  else if (list[0].tag !== "H1") parts.push("El H1 existe, pero no es el primer encabezado.");
  else parts.push("El título principal (H1) va primero, como debe ser.");
  const skips = list.filter((h) => h.skipFrom);
  if (skips.length) parts.push(`${skips.length === 1 ? "Una vez salta" : `${skips.length} veces salta`} un nivel (por ejemplo, de H${skips[0].skipFrom} a ${skips[0].tag}).`);
  else parts.push("Los niveles bajan en orden, sin saltos.");
  const hidden = list.filter((h) => h.hidden).length;
  if (hidden) parts.push(`${hidden} no se ${hidden === 1 ? "ve" : "ven"} en pantalla.`);
  return parts.join(" ");
}

function renderSequence(fullList) {
  const plot = $("sequence");
  const labels = $("seqLabels");
  const readout = $("seqReadout");
  const scroller = $("seqScroll");
  const idle = "Pasa el cursor por un punto para ver cuál es.";
  plot.textContent = "";
  labels.textContent = "";
  readout.textContent = idle;
  readout.classList.remove("on");
  $("seqSummary").textContent = describeSequence(fullList);

  // Interruptor de ocultos: por defecto el mapa muestra solo lo visible.
  const hiddenCount = fullList.filter((h) => h.hidden).length;
  const btn = $("seqHiddenBtn");
  btn.hidden = hiddenCount === 0;
  btn.setAttribute("aria-checked", String(state.seqShowHidden));
  $("seqHiddenLabel").textContent = `Incluir ocultos (${hiddenCount})`;
  const list = state.seqShowHidden ? fullList : fullList.filter((h) => !h.hidden);
  if (hiddenCount && !state.seqShowHidden) {
    $("seqSummary").textContent += ` El mapa muestra solo ${list.length === 1 ? "el visible" : `los ${list.length} visibles`}.`;
  }

  const maxLvl = Math.max(3, ...list.map((h) => +h.tag[1]));
  const n = list.length;
  for (const node of [plot, labels]) node.style.setProperty("--rows", maxLvl);
  plot.style.setProperty("--n", Math.max(n, 1));
  for (let l = 1; l <= maxLvl; l++) {
    labels.append(el("span", null, "H" + l));
    const guide = el("span", "seq-guide");
    guide.style.setProperty("--row", l - 1);
    plot.append(guide);
  }
  if (!n) {
    plot.append(el("span", "seq-none", "Ningún encabezado visible. Activa «Incluir ocultos» para verlos."));
    updateScrollHint();
    return;
  }

  // Saltos según lo que se está mostrando
  const skipFrom = [];
  list.forEach((h, k) => {
    const lvl = +h.tag[1], prev = k ? +list[k - 1].tag[1] : 0;
    skipFrom[k] = prev && lvl > prev + 1 ? prev : 0;
  });

  const ns = "http://www.w3.org/2000/svg";
  const line = document.createElementNS(ns, "svg");
  line.setAttribute("class", "seq-line");
  line.setAttribute("viewBox", `0 0 ${n} ${maxLvl}`);
  line.setAttribute("preserveAspectRatio", "none");
  line.setAttribute("aria-hidden", "true");
  let d = "";
  list.forEach((h, k) => {
    const x = k + 0.5, y = +h.tag[1] - 0.5;
    d += k ? ` L${x} ${y}` : `M${x} ${y}`;
    if (skipFrom[k]) {
      const seg = document.createElementNS(ns, "path");
      seg.setAttribute("d", `M${k - 0.5} ${+list[k - 1].tag[1] - 0.5} L${x} ${y}`);
      seg.setAttribute("class", "seg-skip");
      line.append(seg);
    }
  });
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  line.prepend(path);
  plot.append(line);

  const h1Count = fullList.filter((h) => h.tag === "H1").length;
  list.forEach((h, k) => {
    const lvl = +h.tag[1];
    const dot = el("button", "seq-dot");
    dot.type = "button";
    dot.setAttribute("role", "listitem");
    dot.style.setProperty("--x", k);
    dot.style.setProperty("--row", lvl - 1);
    if (skipFrom[k]) dot.classList.add("skip");
    if (!h.text || (lvl === 1 && h1Count > 1)) dot.classList.add("bad");
    if (h.hidden) dot.classList.add("hid");
    const notes = [];
    if (skipFrom[k]) notes.push(`salta desde H${skipFrom[k]}`);
    if (h.hidden) notes.push("no se ve");
    if (!h.text) notes.push("vacío");
    const label = `${k + 1} de ${n} · ${h.tag} · ${h.text || "(sin texto)"}${notes.length ? "  —  " + notes.join(", ") : ""}`;
    dot.setAttribute("aria-label", label);
    const show = () => { readout.textContent = label; readout.classList.add("on"); };
    const hide = () => { readout.textContent = idle; readout.classList.remove("on"); };
    dot.addEventListener("mouseenter", show);
    dot.addEventListener("focus", show);
    dot.addEventListener("mouseleave", hide);
    dot.addEventListener("blur", hide);
    dot.addEventListener("click", () => locate(h.frameId, h.i));
    plot.append(dot);
  });

  scroller.scrollLeft = 0;
  updateScrollHint();
}

// Sombra y aviso cuando el mapa no cabe y se puede desplazar.
function updateScrollHint() {
  const sc = $("seqScroll");
  const more = sc.scrollWidth - sc.clientWidth > 2;
  sc.classList.toggle("can-left", more && sc.scrollLeft > 2);
  sc.classList.toggle("can-right", more && sc.scrollLeft < sc.scrollWidth - sc.clientWidth - 2);
  $("seqScrollHint").hidden = !more;
}

function renderIssues(issues) {
  const box = $("issues");
  box.textContent = "";
  const real = issues.filter((i) => i.sev !== "info").length;
  $("issuesCount").textContent = real ? String(real) : "";
  if (!real) box.append(el("li", "issues-ok", "Nada que corregir en los encabezados."));
  issues.forEach((issue, idx) => {
    const li = el("li", "issue-row");
    const clickable = issue.targets && issue.targets.length;
    const node = el(clickable ? "button" : "div", `issue ${issue.sev}`);
    if (clickable) node.type = "button";
    const mark = el("span", "issue-mark");
    mark.append(svg(issue.sev === "info" ? ICON.info : ICON.bang));
    node.append(mark, el("span", "issue-title", issue.title));
    if (clickable) {
      const n = issue.targets.length;
      const go = el("span", "issue-go", n === 1 ? "Ver →" : `Ver 1/${n} →`);
      node.append(go);
      node.addEventListener("click", () => {
        const c = state.issueCursor.get(idx) || 0;
        const t = issue.targets[c % n];
        state.issueCursor.set(idx, c + 1);
        if (n > 1) go.textContent = `Ver ${((c + 1) % n) + 1}/${n} →`;
        locate(t.frameId, t.i);
      });
    } else {
      node.append(el("span"));
    }
    node.append(el("span", "issue-desc", issue.desc));
    li.append(node);
    box.append(li);
  });
}

function buildTree(list) {
  const root = { level: 0, children: [] };
  const stack = [root];
  list.forEach((h) => {
    const node = { ...h, level: +h.tag[1], children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });
  return root.children;
}

function renderNode(node, h1Count) {
  const li = el("li", `tree-node lvl-${node.level}`);
  if (node.hidden) li.classList.add("is-hidden");
  const row = el("div", "tree-row");

  if (node.children.length) {
    const t = el("button", "toggle");
    t.type = "button";
    t.setAttribute("aria-expanded", "true");
    t.setAttribute("aria-label", "Contraer o expandir");
    t.append(svg(ICON.chevron));
    t.addEventListener("click", () => {
      const collapsed = li.classList.toggle("collapsed");
      t.setAttribute("aria-expanded", String(!collapsed));
    });
    row.append(t);
  } else {
    row.append(el("span", "toggle-spacer"));
  }

  const tag = el("span", `tag lvl-${node.level}`, node.tag);
  if (node.level === 1 && h1Count > 1) { tag.classList.add("is-error"); tag.title = `Hay ${h1Count} H1 en la página`; }
  else if (node.skipFrom) { tag.classList.add("is-warn"); tag.title = `Salto de nivel: H${node.skipFrom} → ${node.tag}`; }
  row.append(tag);

  const text = el("button", "node-text", node.text || "(vacío)");
  text.type = "button";
  text.title = node.text ? `${node.text}\n\nClic para ubicarlo en la página` : "Encabezado sin texto";
  if (!node.text) text.classList.add("is-empty");
  text.addEventListener("click", () => locate(node.frameId, node.i));
  row.append(text);

  if (node.hidden) { const f = el("span", "flag", "oculto"); f.title = "No es visible en la página"; row.append(f); }
  if (node.skipFrom) { const f = el("span", "flag warn", `salto h${node.skipFrom}→h${node.level}`); f.title = `H${node.skipFrom} → ${node.tag}`; row.append(f); }

  li.append(row);
  if (node.children.length) {
    const ul = el("ul", "tree-children");
    node.children.forEach((c) => ul.append(renderNode(c, h1Count)));
    li.append(ul);
  }
  return li;
}

function renderTree() {
  const box = $("tree");
  box.textContent = "";
  const h1Count = state.main.filter((h) => h.tag === "H1").length;
  const total = state.main.length + state.iframes.reduce((s, f) => s + f.headings.length, 0);
  $("treeCount").textContent = String(total);

  const ul = el("ul");
  buildTree(state.main).forEach((n) => ul.append(renderNode(n, h1Count)));
  box.append(ul);

  state.iframes.forEach((f) => {
    let host = f.url;
    try { host = new URL(f.url).host || f.url; } catch (e) {}
    const g = el("div", "tree-group", `Dentro de iframe · ${host}`);
    g.title = f.url;
    box.append(g);
    const gul = el("ul");
    buildTree(f.headings).forEach((n) => gul.append(renderNode(n, 0)));
    box.append(gul);
  });

  state.allCollapsed = false;
  syncToggleAll();
}

// ---------- Estados ----------
function showEmpty(title = "Todavía no hay análisis", html = null, isError = false) {
  renderPromo("idle");
  $("results").hidden = true;
  $("emptyState").hidden = false;
  $("emptyState").classList.toggle("is-error", isError);
  $("emptyTitle").textContent = title;
  const text = $("emptyText");
  if (html === null) text.innerHTML = "Pulsa <strong>Analizar página</strong> para leer la jerarquía de encabezados de la pestaña activa.";
  else text.textContent = html;
  $("grantBtn").hidden = true;
  if (!isError) resetPageInfo();
  hideStale();
}

async function showError(err) {
  const msg = (err && err.message) || "";
  resetPageInfo();
  if (RESTRICTED.test(msg)) {
    showEmpty("Esta página no se puede analizar", "Chrome no permite extensiones en páginas internas (chrome://), la Chrome Web Store ni el visor de PDF.", true);
    return;
  }
  const granted = await chrome.permissions.contains({ origins: ["<all_urls>"] }).catch(() => false);
  showEmpty(
    "Falta permiso en esta pestaña",
    granted
      ? "Chrome bloqueó el acceso a esta página. Puede ser una página protegida o un archivo local."
      : "Chrome solo da acceso a la pestaña donde hiciste clic en el ícono. Haz clic otra vez en el ícono de la extensión aquí, o permite el acceso a todos los sitios.",
    true,
  );
  $("grantBtn").hidden = granted;
}

function showStale(text) {
  $("staleText").textContent = text;
  $("stale").hidden = false;
}
function hideStale() { $("stale").hidden = true; }

function setLoading(on) {
  const btn = $("analyzeBtn");
  btn.disabled = on;
  btn.querySelector("span").textContent = on ? "Analizando…" : "Analizar página";
  const icon = btn.querySelector("svg");
  icon.innerHTML = on ? ICON.spinner : '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
  icon.classList.toggle("spin", on);
}

function syncToggleAll() {
  $("toggleAllBtn").textContent = state.allCollapsed ? "Expandir" : "Contraer";
}

// ---------- Copiar estructura ----------
function structureText() {
  const line = (h) => `${"  ".repeat(+h.tag[1] - 1)}${h.tag} - ${h.text || "(vacío)"}`;
  const out = state.main.map(line);
  state.iframes.forEach((f) => { out.push("", `# iframe: ${f.url}`, ...f.headings.map(line)); });
  return out.join("\n");
}

async function copyStructure() {
  const text = structureText();
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = el("textarea"); ta.value = text; document.body.append(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  const b = $("copyBtn");
  b.textContent = "Copiado ✓";
  b.classList.add("done");
  setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("done"); }, 1500);
}

// ---------- Eventos ----------
document.addEventListener("DOMContentLoaded", () => {
  $("analyzeBtn").addEventListener("click", analyze);
  $("copyUrlBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(state.pageUrl); } catch (e) {}
    const b = $("copyUrlBtn"), label = b.querySelector("span");
    b.classList.add("done"); label.textContent = "Copiada ✓";
    setTimeout(() => { b.classList.remove("done"); label.textContent = "Copiar URL"; }, 1500);
  });
  setInterval(updateLastRun, 30000);
  $("seqHiddenBtn").addEventListener("click", () => {
    state.seqShowHidden = !state.seqShowHidden;
    renderSequence(state.main);
  });
  $("seqScroll").addEventListener("scroll", updateScrollHint, { passive: true });
  new ResizeObserver(updateScrollHint).observe($("seqScroll"));
  $("staleBtn").addEventListener("click", analyze);
  $("clearBtn").addEventListener("click", clearPage);
  $("copyBtn").addEventListener("click", copyStructure);

  $("toggleAllBtn").addEventListener("click", () => {
    state.allCollapsed = !state.allCollapsed;
    document.querySelectorAll("#tree .tree-node").forEach((li) => {
      if (!li.querySelector(":scope > .tree-children")) return;
      li.classList.toggle("collapsed", state.allCollapsed);
      const t = li.querySelector(":scope > .tree-row .toggle");
      if (t) t.setAttribute("aria-expanded", String(!state.allCollapsed));
    });
    syncToggleAll();
  });

  $("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("kr-theme", next); } catch (e) {}
  });

  $("grantBtn").addEventListener("click", async () => {
    const ok = await chrome.permissions.request({ origins: ["<all_urls>"] }).catch(() => false);
    if (ok) analyze();
  });

  analyze(); // al abrir el panel, el clic en el ícono da permiso sobre la pestaña activa
});

// Cambios de pestaña o de página → los resultados quedan desactualizados.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (state.tabId == null) return;
  if (tabId !== state.tabId) showStale("Estás viendo otra pestaña.");
  else if (!state.navigated) hideStale();
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === state.tabId && info.status === "loading") {
    state.navigated = true;
    showStale("La página se recargó o cambió.");
  }
});

// Resultados del atajo de teclado (Ctrl+Shift+H).
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === "kr-results") { state.navigated = false; handleResults(msg.tabId, msg.results); }
  if (msg.type === "kr-cleared" && msg.tabId === state.tabId) { state.tabId = null; showEmpty(); }
});
