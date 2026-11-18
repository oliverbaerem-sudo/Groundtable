"use strict";

const MONTHS = ["januar","februar","mars","april","mai","juni","juli","august","september","oktober","november","desember"];
const MON_S = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];
const STATUSES = ["Planlagt", "Påmeldt", "Gjennomført"];
const $app = document.getElementById("app");

const iso2 = (y, m, d) => { const t = new Date(y, m - 1, d); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const okEmail = (s) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(s);
const okPhone = (s) => /^[+0-9 ()-]{5,20}$/.test(s);
function contactFor(e) {
  const c = Object.assign({}, e.contact || {}, store.contacts[e.key] || {});
  return (c.name || c.org || c.email || c.phone) ? c : null;
}
function contactHtml(e) {
  const c = contactFor(e);
  const parts = [];
  if (c) {
    if (c.name || c.org) parts.push(`<b>${esc(c.name || c.org)}</b>${c.role ? ` (${esc(c.role)})` : ""}${c.name && c.org ? `, ${esc(c.org)}` : ""}`);
    if (c.email && okEmail(c.email)) parts.push(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
    if (c.phone && okPhone(c.phone)) parts.push(`<a href="tel:${esc(c.phone.replace(/[^+0-9]/g, ""))}">${esc(c.phone)}</a>`);
  }
  const mine = store.contacts[e.key] || {};
  const f = (k, label, ph) => `<label class="field"><span class="lbl">${label}</span><input type="text" data-f="${k}" value="${esc(mine[k] || "")}" placeholder="${ph}" maxlength="80"></label>`;
  return (parts.length ? `<p class="contact"><span class="lbl">Kontakt</span> ${parts.join(" · ")}</p>` : `<p class="contact none">Ingen kontaktinfo funnet ennå.</p>`) +
    `<details class="cedit"><summary>${c ? "Endre kontakt" : "Legg til kontaktperson"}</summary><div class="row">${f("name", "Navn", "Kontaktperson")}${f("email", "E-post", "navn@eksempel.no")}${f("phone", "Telefon", "900 00 000")}<button type="button" class="btn sm" data-act="savecontact" data-key="${esc(e.key)}">Lagre</button></div></details>`;
}
const isBoard = (ev) => !!ev.board || BOARD_SPORTS.includes(ev.sport);
/* Små løp (løping, trail, hinderløp) er bare viktige i Bergen, Oslo, Stavanger og Trondheim. Alle andre steder vises de dempet. */
const RUN_SPORTS = ["Løping", "Trailløp", "Hinderløp"];
const isSmallRunOutsideHome = (ev) => RUN_SPORTS.includes(ev.sport) && !ev.big && !/bergen|oslo|stavanger|trondheim/i.test(ev.place || "");
const isMain = (ev) => isBoard(ev) || (!!(REGIONS[ev.region] && REGIONS[ev.region].main) && !isSmallRunOutsideHome(ev));
/* Hele Norge vises. Bergen- og Oslo-området er hovedfokus. Bare små løp utenfor Bergen, Oslo, Stavanger og Trondheim vises dempet. */
const isMuted = (ev) => !isBoard(ev) && isSmallRunOutsideHome(ev);

/* ---------- Lagring (kun denne nettleseren) ---------- */
let store = { custom: [], joined: {}, contacts: {}, showSmall: true };
try { store = Object.assign(store, JSON.parse(localStorage.getItem("vl-store") || "{}")); } catch (e) {}
const save = () => { try { localStorage.setItem("vl-store", JSON.stringify(store)); } catch (e) {} };

/* ---------- Arrangementer ---------- */
function seedEvent(base, y) {
  const s = base.on && base.on[y] ? Object.assign({}, base, base.on[y]) : base;
  return { key: `${s.id}@${y}`, id: s.id, name: s.name, date: iso(y, s.m, s.d), end: s.end ? iso2(y, s.m, s.end) : "",
    place: s.place, region: s.region, sport: s.sport, contact: s.contact || null, big: !!s.big, board: !!s.board, student: !!s.student, added: s.added || "", official: s.official || "", url: s.url || "", info: s.info || "", approx: true, fromSearch: !!s.year, custom: false, participants: s.participants || null };
}
function customEvent(c) { return { key: c.id, id: c.id, name: c.name, date: c.date, end: c.end || "", place: c.place, region: c.region,
  sport: c.sport, link: c.link, notes: c.notes, approx: false, custom: true, status: c.status }; }

function eventsForYear(y) {
  const seeds = SEED.filter((s) => !s.year || s.year === y).map((s) => seedEvent(s, y));
  const custom = store.custom.map(customEvent).filter((e) => e.date.startsWith(y + "-"));
  return [...seeds, ...custom].map(withStatus).sort(byDate);
}
function withStatus(e) { if (!e.custom) e.status = store.joined[e.key] || ""; return e; }
const byDate = (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "nb");
const isMine = (e) => e.custom || !!store.joined[e.key];
const endOf = (e) => e.end || e.date;

function upcoming(withPast) {
  const t = todayIso(), y = new Date().getFullYear();
  return [...eventsForYear(y), ...eventsForYear(y + 1)].filter((e) => withPast ? e.date >= y + "-01-01" : endOf(e) >= t).sort(byDate);
}
const isPast = (e) => endOf(e) < todayIso();
const isoOf = (d) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoOf(d); };
const isNew = (e) => !!e.added && e.added >= daysAgoIso(7);
const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
function recentEvents() {
  const y = new Date().getFullYear(), map = new Map();
  [...eventsForYear(y), ...eventsForYear(y + 1)].forEach((e) => { if (e.added && endOf(e) >= todayIso()) map.set(e.key, e); });
  return [...map.values()];
}
function myEvents() {
  const out = store.custom.map(customEvent);
  for (const key of Object.keys(store.joined)) {
    const [id, y] = key.split("@"); const s = SEED.find((x) => x.id === id);
    if (s) out.push(withStatus(seedEvent(s, Number(y))));
  }
  return out.sort(byDate);
}

/* ---------- Visning av kort ---------- */
function fmtDate(e) {
  const d = parse(e.date);
  return `<div class="date"><b>${d.getDate()}</b><span>${MON_S[d.getMonth()]}</span>${e.end ? `<i>til ${parse(e.end).getDate()}. ${MON_S[parse(e.end).getMonth()]}</i>` : ""}</div>`;
}
function partsHtml(e) {
  const p = e.participants;
  if (!p || (!Number.isFinite(p.registered) && !Number.isFinite(p.expected))) return "";
  const src = safeUrl(p.src), nf = (n) => n.toLocaleString("nb-NO");
  const bits = [];
  if (Number.isFinite(p.registered)) bits.push(`<strong>${nf(p.registered)}</strong> påmeldte`);
  if (Number.isFinite(p.expected)) bits.push(`ca. <strong>${nf(p.expected)}</strong> forventet${p.basis ? ` (${esc(p.basis)})` : ""}`);
  const asOf = p.asOf ? `per ${esc(p.asOf)}` : "";
  return `<p class="parts"><span class="lbl">Deltakere</span> ${bits.join(" · ")} ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">${asOf || "kilde"} ↗</a>` : asOf}</p>`;
}
function card(e, ctx) {
  const main = isMain(e), r = REGIONS[e.region];
  const q = encodeURIComponent(e.name + " " + e.date.slice(0, 4) + " offisiell nettside");
  const link = e.custom ? safeUrl(e.link) : e.url;
  const search = `https://www.google.com/search?q=${q}`;
  const check = e.approx && !e.url ? search : "";
  const mine = isMine(e);
  let actions = "";
  if (!e.custom) actions += `<button class="btn sm ${mine ? "ghost" : "accent"}" data-act="toggle" data-key="${esc(e.key)}">${mine ? "Fjern fra mine" : "Jeg stiller på"}</button>`;
  if (link) actions += `<a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">Gå til nettside ↗</a>`;
  else if (e.info) actions += `<a class="btn sm" href="${esc(e.info)}" target="_blank" rel="noopener">Mer info ↗</a>`;
  else actions += `<a class="btn sm ghost" href="${esc(search)}" target="_blank" rel="noopener">Finn nettside ↗</a>`;
  if (e.approx && !e.official && (e.info || !e.url)) actions += `<a class="btn sm ghost" href="${esc(search)}" target="_blank" rel="noopener">Sjekk dato</a>`;
  if (ctx === "mine") {
    actions += `<select class="status" aria-label="Status for ${esc(e.name)}" data-act="status" data-key="${esc(e.key)}" style="width:auto;min-height:34px;padding:4px 8px">${STATUSES.map((s) => `<option${(e.status || "Planlagt") === s ? " selected" : ""}>${s}</option>`).join("")}</select>`;
    if (e.custom) actions += `<button class="btn sm danger" data-act="del" data-key="${esc(e.key)}">Slett</button>`;
  }
  const past = isPast(e);
  return `<li class="card${isMuted(e) ? " minor" : main ? "" : " rest"}${isBoard(e) ? " board" : ""}${past ? " past" : ""}">${fmtDate(e)}<div style="min-width:0">
    <h3>${esc(e.name)}</h3>
    <p class="meta">${esc(e.place || "Sted ikke oppgitt")} · ${esc(r ? r.label : "")} · ${esc(e.sport)}</p>
    ${e.notes ? `<p class="meta">${esc(e.notes)}</p>` : ""}
    ${partsHtml(e)}
    ${contactHtml(e)}
    <div class="tags">
      ${isNew(e) ? `<span class="tag new">Ny</span>` : ""}
      ${isBoard(e) ? `<span class="tag board">Brettsport</span>` : ""}
      ${e.student ? `<span class="tag ok">Student</span>` : ""}
      ${isMuted(e) ? `<span class="tag minor">Mindre viktig</span>` : ""}
      ${past ? `<span class="tag">Avholdt</span>` : ""}
      ${e.custom || e.big ? "" : `<span class="tag">Mindre arrangement</span>`}
      ${e.official ? `<span class="tag ok">Dato fra ${esc(typeof e.official === "string" ? e.official : "Brettforbundet")}</span>` : ""}
      ${e.approx && !e.official ? `<span class="tag warn">${e.fromSearch ? "Dato fra nettsøk" : "Dato omtrentlig"}</span>` : ""}
      ${e.custom ? `<span class="tag mine">Lagt til av meg</span>` : mine ? `<span class="tag mine">Jeg stiller på</span>` : ""}
      ${ctx === "mine" && e.status ? `<span class="tag ${e.status === "Gjennomført" ? "ok" : ""}">${esc(e.status)}</span>` : ""}
    </div>
    ${actions ? `<div class="actions">${actions}</div>` : ""}</div></li>`;
}
const listHtml = (evs, ctx, emptyMsg) => evs.length ? `<ul class="list">${evs.map((e) => card(e, ctx)).join("")}</ul>` : `<div class="empty">${emptyMsg}</div>`;
const minorSwitch = () => `<label class="switch"><input type="checkbox" id="showMinor"${store.showSmall ? " checked" : ""}> Vis også små løp utenfor Bergen, Oslo, Stavanger og Trondheim</label>`;
const visible = (evs) => store.showSmall ? evs : evs.filter((e) => !isMuted(e));

const sportOptions = (sel, group) => Object.entries(SPORT_GROUPS).filter(([g]) => !group || g === group).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((s) => `<option${s === sel ? " selected" : ""}>${esc(s)}</option>`).join("")}</optgroup>`).join("");

/* ---------- Side: Forside (tre kategoribokser) ---------- */
const F0 = () => ({ q: "", sport: "", group: "", region: "", month: "", size: "", past: false, board: false, student: false });
const homeTile = (go, n, title, sub, color, icon) => `<button type="button" class="tile${n ? "" : " empty-t"}" data-go="${esc(go)}" style="--c:${color || "var(--brand)"}">${icon ? `<span class="tile-ic" aria-hidden="true">${icon}</span>` : ""}<span class="tile-n">${n}</span><span class="tile-t">${esc(title)}</span>${sub ? `<span class="tile-s">${esc(sub)}</span>` : ""}</button>`;
function viewHjem() {
  const all = visible(upcoming(false));
  const nNew = all.filter(isNew).length, nb = all.find(isBoard);
  const days = nb ? Math.max(0, Math.round((parse(nb.date) - parse(todayIso())) / 86400000)) : 0;
  const nextLine = nb ? `<aside class="board-next" aria-label="Neste brettarrangement"><p class="bn-eyebrow">Neste brettarrangement</p>
      <div class="bn-days"><b>${days}</b><span>${days === 1 ? "dag" : "dager"}</span></div>
      <h2>${esc(nb.name)}</h2>
      <p class="bn-meta">${esc(nb.place)} · ${parse(nb.date).getDate()}. ${MONTHS[parse(nb.date).getMonth()]} ${parse(nb.date).getFullYear()}</p>
      ${(nb.url || nb.info) ? `<a class="btn sm accent" href="${esc(nb.url || nb.info)}" target="_blank" rel="noopener">Gå til nettside ↗</a>` : ""}</aside>` : "";
  const box = (href, title, sub, color) => `<a class="catbox" href="${href}" style="--c:${color}"><span class="cb-t">${title}</span><span class="cb-s">${sub}</span><span class="cb-go" aria-hidden="true">→</span></a>`;
  $app.innerHTML = `<div class="stack home">
    <section class="hero"><div class="hero-in hero-grid"><div class="hero-main"><h1>Velkommen til Groundtable</h1>
      <p class="hero-sub">Finn ditt neste arrangement</p>
      <p class="lead">Groundtable samler sports- og idrettsarrangementer fra hele Norge på ett sted, med hovedfokus på Bergen, Oslo, Stavanger og Trondheim. Her finner du alt fra surfing og skate til motorsport, uvanlige idretter og studentarrangementer. Alle er for deltakere fra 18 år, og listen oppdateres hver natt.</p>
      <form id="homeSearch" class="home-search" role="search"><input type="search" id="hq" placeholder="Søk på navn eller sted" aria-label="Søk"><button class="btn accent" type="submit">Søk</button></form>
      <dl class="stats"><div><dt>${all.length}</dt><dd>kommende</dd></div><div><dt>${all.filter(isBoard).length}</dt><dd>brettsport</dd></div><div><dt>${all.filter((e) => e.student).length}</dt><dd>student</dd></div><div><dt>${nNew}</dt><dd>nye denne uken</dd></div></dl></div>
      ${nextLine}</div></section>
    <section class="cats" aria-label="Utforsk">
      ${box("#sport", "Sport", `${Object.keys(SPORT_GROUPS).length} grupper, fra brettsport til motorsport`, "#5b3fc4")}
      ${box("#omrade", "Område", "Bergen, Oslo, Stavanger, Trondheim og resten av Norge", "#0f5d70")}
      ${box("#kalender", "Måned", "Kalender og liste, måned for måned", "#b8710a")}
    </section>
    <p class="row" style="justify-content:center"><button type="button" class="btn ghost" data-go="all:">Se alle ${all.length} arrangementer</button></p></div>`;
}
function viewKategori(kind) {
  const all = visible(upcoming(false)), t0 = new Date();
  let title, body;
  if (kind === "sport") {
    title = "Velg sport";
    body = `<div class="tiles">${Object.entries(SPORT_GROUPS).map(([g, list]) => {
      const ge = all.filter((e) => list.includes(e.sport)), have = [...new Set(ge.map((e) => e.sport))];
      return homeTile("group:" + g, ge.length, g, (have.length ? have : list).slice(0, 3).join(", "), GROUP_COLORS[g], GROUP_ICONS[g]);
    }).join("")}</div>`;
  } else if (kind === "omrade") {
    title = "Velg område";
    const rc = (k) => all.filter((e) => e.region === k).length;
    const main = Object.entries(REGIONS).filter(([, r]) => r.main), rest = Object.entries(REGIONS).filter(([, r]) => !r.main);
    body = `<div class="tiles">${main.map(([k, r]) => homeTile("region:" + k, rc(k), r.label.replace(/ \(.*\)/, ""), (r.label.match(/\((.*)\)/) || [, ""])[1], "var(--brand)")).join("")}</div>
      <p class="lbl" style="margin:18px 0 8px">Resten av Norge</p><div class="chips">${rest.map(([k, r]) => `<button type="button" class="chip" data-go="region:${k}">${esc(r.label)} <b>${rc(k)}</b></button>`).join("")}</div>`;
  } else {
    title = "Velg måned";
    body = `<div class="mtiles">${Array.from({ length: 12 }, (_, i) => { const m = (t0.getMonth() + i) % 12, n = all.filter((e) => parse(e.date).getMonth() === m).length;
      return `<button type="button" class="mtile${n ? "" : " empty-t"}" data-go="month:${m + 1}"><span>${MONTHS[m]}</span><b>${n}</b></button>`; }).join("")}</div>`;
  }
  $app.innerHTML = `<div class="stack"><div><a class="back" href="#hjem">← Forside</a><h1>${title}</h1></div>${body}</div>`;
}
const viewSport = () => viewKategori("sport"), viewOmrade = () => viewKategori("omrade"), viewManed = () => viewKategori("maned");

/* ---------- Side: Søk ---------- */
const GROUP_ICONS = { "Brettsport": "🏄", "Løp og terreng": "🏃", "Sykkel": "🚴", "Vann": "🏊", "Luft": "🪂", "Vinter": "⛷️", "Ball og racket": "⚽", "Styrke og kamp": "🥊", "Motorsport": "🏎️", "Dyr": "🐎", "Annet": "⭐" };
const GROUP_COLORS = { "Brettsport": "#5b3fc4", "Løp og terreng": "#0f5d70", "Sykkel": "#b8710a", "Vann": "#1479b8", "Luft": "#6f8aa0", "Vinter": "#3f86bf", "Ball og racket": "#2f8f5b", "Styrke og kamp": "#b2392f", "Motorsport": "#d9482a", "Dyr": "#8a5a2b", "Annet": "#6b7b82" };
const groupOf = (sport) => (Object.entries(SPORT_GROUPS).find(([, l]) => l.includes(sport)) || ["Annet"])[0];
const colorOf = (e) => GROUP_COLORS[groupOf(e.sport)] || "#6b7b82";
const F = { q: "", sport: "", group: "", region: "", month: "", size: "", past: false, board: false, student: false };
function viewSok() {
  const all = upcoming(false);
  const nextBoard = all.find(isBoard), next = nextBoard || all.find(isMain);
  let hero = "";
  if (next) {
    const days = Math.max(0, Math.round((parse(next.date) - parse(todayIso())) / 86400000));
    hero = `<section class="next" aria-label="Neste arrangement"><div class="big">${days}<small>${days === 1 ? "dag" : "dager"}</small></div>
      <div><h2>${esc(next.name)}</h2><p>${esc(next.place)} · ${parse(next.date).getDate()}. ${MONTHS[parse(next.date).getMonth()]} ${parse(next.date).getFullYear()} · ${nextBoard ? "neste brettarrangement" : "neste hovedarrangement"}</p></div></section>`;
  }
  const regionOpts = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}"${F.region === k ? " selected" : ""}>${esc(r.label)}</option>`).join("");
  const monthOpts = MONTHS.map((m, i) => `<option value="${i + 1}"${F.month == i + 1 ? " selected" : ""}>${m}</option>`).join("");
  const vis = visible(all);
  const gCount = (g) => vis.filter((e) => SPORT_GROUPS[g].includes(e.sport)).length;
  const groupChips = `<button type="button" class="chip" data-group="" aria-pressed="${!F.group}">Alle <b>${vis.length}</b></button>` +
    Object.keys(SPORT_GROUPS).map((g) => `<button type="button" class="chip" data-group="${esc(g)}" aria-pressed="${F.group === g}" style="--c:${GROUP_COLORS[g]}">${esc(g)} <b>${gCount(g)}</b></button>`).join("");
  const banner = `<section class="hero"><div class="hero-in"><p class="eyebrow">Hele Norge · fokus på Bergen, Oslo, Stavanger og Trondheim</p>
      <h1>Finn ditt neste sportsarrangement</h1>
      <p class="lead">Brettsport først, så motorsport, uvanlige idretter og studentarrangementer. Kun for deltakere fra 18 år.</p>
      <dl class="stats"><div><dt>${vis.length}</dt><dd>kommende</dd></div><div><dt>${vis.filter(isBoard).length}</dt><dd>brettsport</dd></div><div><dt>${vis.filter((e) => e.student).length}</dt><dd>student</dd></div><div><dt>${vis.filter(isNew).length}</dt><dd>nye denne uken</dd></div></dl></div></section>`;
  const act = [];
  if (F.group) act.push(["group", F.group]);
  if (F.sport) act.push(["sport", F.sport]);
  if (F.region) act.push(["region", (REGIONS[F.region] || {}).label || F.region]);
  if (F.month) act.push(["month", MONTHS[Number(F.month) - 1]]);
  if (F.board) act.push(["board", "Brettsport"]);
  if (F.student) act.push(["student", "Student"]);
  if (F.size) act.push(["size", F.size === "stor" ? "Store arrangementer" : "Mindre arrangementer"]);
  const chipsAct = act.length ? `<div class="active">${act.map(([k, l]) => `<button type="button" class="fchip" data-clear="${k}" aria-label="Fjern filter ${esc(l)}">${esc(l)} ✕</button>`).join("")}<button type="button" class="fchip clear" data-go="all:">Nullstill</button></div>` : "";
  $app.innerHTML = `<div class="stack">
    <div><a class="back" href="#hjem">← Forside</a><h1>Arrangementer</h1></div>
    <div class="field"><label for="q">Søk</label><input type="search" id="q" placeholder="Navn eller sted, f.eks. Bergen" value="${esc(F.q)}"></div>
    ${chipsAct}
    <details class="filters more"><summary>Flere filter</summary>
      <div class="row">
        <div class="field"><label for="fRegion">Område</label><select id="fRegion"><option value="">Alle</option>${regionOpts}</select></div>
        <div class="field"><label for="fSportSel">Idrett</label><select id="fSportSel"><option value="">Alle idretter</option>${sportOptions(F.sport, F.group)}</select></div>
        <div class="field"><label for="fSize">Størrelse</label><select id="fSize"><option value="">Alle</option><option value="stor"${F.size === "stor" ? " selected" : ""}>Store arrangementer</option><option value="liten"${F.size === "liten" ? " selected" : ""}>Mindre arrangementer</option></select></div>
        <div class="field"><label for="fMonth">Måned</label><select id="fMonth"><option value="">Alle</option>${monthOpts}</select></div>
      </div>
      <div class="row"><label class="switch"><input type="checkbox" id="onlyBoard"${F.board ? " checked" : ""}> Bare brettsport</label><label class="switch"><input type="checkbox" id="onlyStudent"${F.student ? " checked" : ""}> Bare studentarrangementer</label>${minorSwitch()}<label class="switch"><input type="checkbox" id="showPast"${F.past ? " checked" : ""}> Vis også tidligere i år</label></div>
    </details>
    <section id="results" aria-live="polite"></section></div>`;
  updateResults();
}
function monthGroups(evs) {
  const m = new Map();
  evs.forEach((e) => { const k = e.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
  return [...m.entries()].map(([k, list]) => { const d = parse(k + "-01");
    return `<section class="mgrp"><h3 class="mh">${MONTHS[d.getMonth()]} ${d.getFullYear()}<small>${list.length}</small></h3>${listHtml(list, "sok")}</section>`; }).join("");
}
function groupSections(evs) {
  const cards = Object.entries(SPORT_GROUPS).map(([g, list]) => {
    const ge = evs.filter((e) => list.includes(e.sport)); if (!ge.length) return "";
    const counts = list.map((s) => [s, ge.filter((e) => e.sport === s).length]).filter(([, c]) => c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `${esc(s)} ${c}`).join(" · ");
    return `<details class="grp" style="--c:${GROUP_COLORS[g] || "var(--brand)"}"${g === "Brettsport" ? " open" : ""}><summary><span class="g-t">${esc(g)}</span><span class="g-s">${counts}</span><span class="g-n">${ge.length}</span></summary><div class="grp-body">${listHtml(ge, "sok")}</div></details>`;
  }).join("");
  return `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn sm ghost" data-act="grp-all" data-open="1">Åpne alle</button><button class="btn sm ghost" data-act="grp-all" data-open="0">Lukk alle</button></div>${cards}`;
}
function updateResults() {
  const q = F.q.trim().toLowerCase();
  const gl = F.group ? SPORT_GROUPS[F.group] : null;
  const evs = visible(upcoming(F.past)).filter((e) =>
    (!q || (e.name + " " + e.place).toLowerCase().includes(q)) && (!F.sport || e.sport === F.sport) && (!gl || gl.includes(e.sport)) && (!F.board || isBoard(e)) && (!F.student || e.student) &&
    (!F.region || e.region === F.region) && (!F.size || (F.size === "stor") === !!(e.big)) && (!F.month || parse(e.date).getMonth() + 1 === Number(F.month)));
  const n = evs.length;
  const label = F.group ? ` i ${F.group.toLowerCase()}` : "";
  const body = !n ? listHtml([], "sok", "Ingen treff. Prøv å fjerne et filter, eller legg til arrangementet selv under «Mine».")
    : (!F.group && !F.sport) ? groupSections(evs) : monthGroups(evs);
  document.getElementById("results").innerHTML = `<h2 style="margin-bottom:10px">${n} ${n === 1 ? "arrangement" : "arrangementer"}${label}${F.past ? " i år og fremover" : " fremover"}</h2>` + body;
}

/* ---------- Side: Denne måneden (kalender) ---------- */
const now0 = new Date();
const CAL = { y: now0.getFullYear(), m: now0.getMonth(), sel: "" };
function viewKalender() {
  const evs = visible(eventsForYear(CAL.y));
  const first = new Date(CAL.y, CAL.m, 1), startOffset = (first.getDay() + 6) % 7;
  const daysIn = new Date(CAL.y, CAL.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < Math.ceil((startOffset + daysIn) / 7) * 7; i++) {
    const d = new Date(CAL.y, CAL.m, 1 - startOffset + i);
    cells.push(iso(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  const allYears = [...new Set(cells.map((c) => c.slice(0, 4)))].filter((y) => Number(y) !== CAL.y);
  let pool = evs; allYears.forEach((y) => { pool = pool.concat(visible(eventsForYear(Number(y)))); });
  const onDay = (c) => pool.filter((e) => e.date <= c && c <= endOf(e));
  const t = todayIso();
  const grid = cells.map((c) => {
    const d = parse(c), de = onDay(c), out = d.getMonth() !== CAL.m;
    const pills = de.slice(0, 3).map((e) => `<span class="pill${isMine(e) ? " mine" : ""}${isMuted(e) ? " minor" : ""}" style="--c:${colorOf(e)}" title="${esc(e.name)} (${esc(groupOf(e.sport))})">${esc(e.name)}</span>`).join("") + (de.length > 3 ? `<span class="pill minor">+${de.length - 3}</span>` : "");
    return `<button type="button" class="day${out ? " out" : ""}${c === t ? " today" : ""}${c === CAL.sel ? " sel" : ""}" data-day="${c}" aria-label="${d.getDate()}. ${MONTHS[d.getMonth()]}, ${de.length} arrangementer"><span class="n">${d.getDate()}</span><span class="dots">${pills}</span></button>`;
  }).join("");
  const monthStart = iso(CAL.y, CAL.m + 1, 1), monthEnd = iso(CAL.y, CAL.m + 1, daysIn);
  let list = pool.filter((e) => e.date <= monthEnd && endOf(e) >= monthStart);
  list = [...new Map(list.map((e) => [e.key, e])).values()].sort(byDate);
  const selList = CAL.sel ? onDay(CAL.sel) : null;
  const isCurrent = CAL.y === now0.getFullYear() && CAL.m === now0.getMonth();
  $app.innerHTML = `<div class="stack">
    <div><a class="back" href="#hjem">← Forside</a><h1>${isCurrent ? "Denne måneden" : "Kalender"}</h1></div>
    <div class="mstrip" role="group" aria-label="Hopp til måned">${Array.from({ length: 12 }, (_, i) => { const d = new Date(now0.getFullYear(), now0.getMonth() + i, 1); const on = d.getFullYear() === CAL.y && d.getMonth() === CAL.m;
      return `<button type="button" class="chip" data-calto="${d.getFullYear()}-${d.getMonth()}" aria-pressed="${on}">${MON_S[d.getMonth()]}${d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : ""}</button>`; }).join("")}</div>
    <div class="cal-head"><button class="btn ghost" data-cal="-1" aria-label="Forrige måned">←</button>
      <h2>${MONTHS[CAL.m]} ${CAL.y}</h2><button class="btn ghost" data-cal="1" aria-label="Neste måned">→</button></div>
    <div class="row" style="justify-content:space-between">${minorSwitch()}${isCurrent ? "" : `<button class="btn sm ghost" data-cal="0">Til inneværende måned</button>`}</div>
    <div class="legend">${[...new Set(list.map((e) => groupOf(e.sport)))].map((g) => `<span class="l-grp" style="--c:${GROUP_COLORS[g]}">${esc(g)}</span>`).join("")}<span class="l-minor">Dempet: små løp utenfor de fire byene</span><span class="l-mine">Ring: mine</span></div>
    <div class="cal"><div class="cal-grid">${["man","tir","ons","tor","fre","lør","søn"].map((d) => `<div class="dow">${d}</div>`).join("")}${grid}</div></div>
    ${selList ? `<section><div class="sec-head"><h2>${parse(CAL.sel).getDate()}. ${MONTHS[parse(CAL.sel).getMonth()]}</h2><button class="btn sm ghost" data-day="">Vis hele måneden</button></div><div style="margin-top:10px">${listHtml(selList, "kal", "Ingen arrangementer denne dagen.")}</div></section>`
      : `<section><h2 style="margin-bottom:10px">Alle i ${MONTHS[CAL.m]}</h2>${listHtml(list, "kal", `Ingen kjente arrangementer i ${MONTHS[CAL.m]}. Bruk pilene for å bla, eller legg til egne under «Mine».`)}</section>`}
  </div>`;
}

/* ---------- Side: Året ---------- */
const YEAR = { y: now0.getFullYear() };
function viewAret() {
  const evs = visible(eventsForYear(YEAR.y));
  const months = MONTHS.map((name, i) => {
    const me = evs.filter((e) => parse(e.date).getMonth() === i);
    const cur = YEAR.y === now0.getFullYear() && i === now0.getMonth();
    return `<section class="month${cur ? " now" : ""}"><h2>${name}<small>${me.length ? me.length + (me.length === 1 ? " arrangement" : " arrangementer") : ""}</small></h2>${me.length ? listHtml(me, "aret") : `<p class="meta" style="margin:0">Ingen kjente arrangementer.</p>`}</section>`;
  }).join("");
  $app.innerHTML = `<div class="stack"><div><h1>Året ${YEAR.y}</h1><p class="lead">Alle arrangementer gjennom året, måned for måned.</p></div>
    <div class="row" style="justify-content:space-between"><div class="row"><button class="btn ghost" data-year="-1" aria-label="Forrige år">←</button><button class="btn ghost" data-year="1" aria-label="Neste år">→</button></div>${minorSwitch()}</div>
    ${months}</div>`;
}

/* ---------- Side: Mine ---------- */
function viewMine() {
  const all = myEvents(), t = todayIso();
  const up = all.filter((e) => endOf(e) >= t), past = all.filter((e) => endOf(e) < t).reverse();
  const regionOpts = (main) => Object.entries(REGIONS).filter(([, r]) => r.main === main).map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join("");
  $app.innerHTML = `<div class="stack"><div><h1>Mine arrangementer</h1><p class="lead">Det du skal stille på. Trykk «Jeg stiller på» på et arrangement for å legge det hit, eller legg til et nytt under.</p></div>
    <section><h2 style="margin-bottom:10px">Kommende</h2>${listHtml(up, "mine", "Ingenting planlagt ennå. Legg til et arrangement under.")}</section>
    <section><div class="sec-head"><h2>Legg til nytt arrangement</h2></div>
    <form class="add" id="addForm" style="margin-top:10px" autocomplete="off">
      <p class="meta" style="margin:0">Legg bare inn arrangementer for deltakere fra 18 år.</p>
      <div class="field"><label for="fName">Navn</label><input type="text" id="fName" required maxlength="100" placeholder="F.eks. Bergen City Marathon"></div>
      <div class="row"><div class="field"><label for="fDate">Dato</label><input type="date" id="fDate" required></div>
        <div class="field"><label for="fEnd">Til dato (valgfritt)</label><input type="date" id="fEnd"></div></div>
      <div class="row"><div class="field"><label for="fPlace">Sted</label><input type="text" id="fPlace" maxlength="80" placeholder="F.eks. Bergen"></div>
        <div class="field"><label for="fReg">Område</label><select id="fReg"><optgroup label="Hovedfokus: Bergen, Oslo, Stavanger og Trondheim">${regionOpts(true)}</optgroup><optgroup label="Resten av Norge">${regionOpts(false)}</optgroup></select></div></div>
      <div class="row"><div class="field"><label for="fSport">Idrett</label><select id="fSport">${sportOptions("")}</select></div>
        <div class="field"><label for="fStatus">Status</label><select id="fStatus">${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select></div></div>
      <div class="row"><div class="field"><label for="fCName">Kontaktperson (valgfritt)</label><input type="text" id="fCName" maxlength="80"></div>
        <div class="field"><label for="fCEmail">E-post</label><input type="text" id="fCEmail" maxlength="80"></div>
        <div class="field"><label for="fCPhone">Telefon</label><input type="text" id="fCPhone" maxlength="20"></div></div>
      <div class="field"><label for="fLink">Lenke (valgfritt)</label><input type="url" id="fLink" placeholder="https://"></div>
      <div class="field"><label for="fNotes">Notat (valgfritt)</label><textarea id="fNotes" rows="2" maxlength="300" placeholder="Startnummer, reise, overnatting …"></textarea></div>
      <div><button class="btn accent" type="submit">Legg til</button></div>
    </form></section>
    ${past.length ? `<section><h2 style="margin-bottom:10px">Tidligere</h2>${listHtml(past, "mine")}</section>` : ""}</div>`;
}

/* ---------- Side: Idretter (meny med overordnede aktiviteter) ---------- */
function viewIdretter() {
  const evs = visible(upcoming(false));
  const tiles = Object.entries(SPORT_GROUPS).map(([g, list]) => {
    const ge = evs.filter((e) => list.includes(e.sport)), n = ge.length;
    const have = list.filter((s) => ge.some((e) => e.sport === s));
    return `<button type="button" class="tile${n ? "" : " empty-t"}" data-group="${esc(g)}" style="--c:${GROUP_COLORS[g] || "var(--brand)"}"><span class="tile-n">${n}</span><span class="tile-t">${esc(g)}</span><span class="tile-s">${esc((have.length ? have : list).slice(0, 5).join(", "))}${(have.length ? have : list).length > 5 ? " …" : ""}</span></button>`;
  }).join("");
  const nStud = evs.filter((e) => e.student).length;
  $app.innerHTML = `<div class="stack"><div><p class="eyebrow dark">Velg aktivitet</p><h1>Idretter</h1><p class="lead">Velg en overordnet aktivitet for å se alle arrangementer innenfor den.</p></div>
    <div class="tiles">${tiles}<button type="button" class="tile" data-student="1" style="--c:#17703f"><span class="tile-n">${nStud}</span><span class="tile-t">Studentarrangementer</span><span class="tile-s">Studentlekene, Student-NM og mer</span></button></div>
    <div><button type="button" class="btn ghost" data-group="">Se alle idretter</button></div></div>`;
}

/* ---------- Side: Nytt (nylig lagt til, gruppert per uke) ---------- */
function viewNytt() {
  const evs = visible(recentEvents()), weeks = {};
  evs.forEach((e) => { const k = isoOf(mondayOf(e.added)); (weeks[k] = weeks[k] || []).push(e); });
  const keys = Object.keys(weeks).sort().reverse();
  const html = keys.map((k, i) => {
    const mon = parse(k), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const list = weeks[k].sort(byDate), n = list.length;
    const range = `${mon.getDate()}. ${MON_S[mon.getMonth()]} – ${sun.getDate()}. ${MON_S[sun.getMonth()]}`;
    return `<details class="week"${i === 0 ? " open" : ""}><summary><span class="wk">Uke ${isoWeek(mon)}</span><span class="wk-range">${range}</span><span class="wk-n">${n} ${n === 1 ? "nytt" : "nye"}</span></summary><div class="week-body">${listHtml(list, "nytt")}</div></details>`;
  }).join("");
  $app.innerHTML = `<div class="stack"><div><p class="eyebrow dark">Nylig lagt til</p><h1>Nytt i kalenderen</h1><p class="lead">Arrangementer vi har lagt til, samlet per uke. Den nyeste uken ligger øverst. Arrangementer lagt til før 10. november vises ikke her.</p></div>
    <div class="row" style="justify-content:flex-end">${minorSwitch()}</div>
    ${html || `<div class="empty">Ingen nye arrangementer enda. Nye arrangementer dukker opp her etter hvert.</div>`}</div>`;
}


/* ---------- Planlagt, dato ikke fastsatt ---------- */
function plannedCard(p) {
  const r = REGIONS[p.region], ev = { board: p.board, sport: p.sport, region: p.region, big: p.big, place: p.place };
  const link = p.url || p.info;
  const q = encodeURIComponent(p.name + " dato");
  const c = contactFor({ key: "pl:" + p.id, contact: p.contact });
  const contact = c ? `<p class="contact"><span class="lbl">Kontakt</span> ${[c.name || c.org, c.email && okEmail(c.email) ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "", c.phone && okPhone(c.phone) ? esc(c.phone) : ""].filter(Boolean).join(" · ")}</p>` : "";
  return `<li class="card planned${isBoard(ev) ? " board" : ""}"><div class="date"><b>?</b><span>dato</span><i>${esc(p.when || "ikke satt")}</i></div><div style="min-width:0">
    <h3>${esc(p.name)}</h3>
    <p class="meta">${esc(p.place || "Sted ikke oppgitt")} · ${esc(r ? r.label : "")} · ${esc(p.sport)}</p>
    ${p.note ? `<p class="meta">${esc(p.note)}</p>` : ""}${contact}
    <div class="tags"><span class="tag warn">Dato ikke fastsatt</span>${p.added && p.added >= daysAgoIso(7) ? `<span class="tag new">Ny</span>` : ""}${isBoard(ev) ? `<span class="tag board">Brettsport</span>` : ""}${p.student ? `<span class="tag ok">Student</span>` : ""}</div>
    <div class="actions">${link ? `<a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">Gå til nettside ↗</a>` : ""}<a class="btn sm ghost" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Sjekk om dato er satt</a></div></div></li>`;
}
function viewPlanlagt() {
  const all = (typeof PLANNED !== "undefined" ? PLANNED : []).slice().sort((a, b) => (b.added || "").localeCompare(a.added || "") || a.name.localeCompare(b.name, "nb"));
  const groups = Object.entries(SPORT_GROUPS).map(([g, list]) => {
    const ge = all.filter((p) => list.includes(p.sport)); if (!ge.length) return "";
    return `<details class="grp" style="--c:${GROUP_COLORS[g] || "var(--brand)"}" open><summary><span class="g-t">${esc(g)}</span><span class="g-s"></span><span class="g-n">${ge.length}</span></summary><div class="grp-body"><ul class="list">${ge.map(plannedCard).join("")}</ul></div></details>`;
  }).join("");
  $app.innerHTML = `<div class="stack"><div><p class="eyebrow dark">Under planlegging</p><h1>Planlagt, dato kommer</h1><p class="lead">Arrangementer som er annonsert, men der arrangøren ikke har offentliggjort en eksakt dato. Vi gjetter aldri datoer. Når datoen er satt, flyttes arrangementet til den vanlige kalenderen.</p></div>
    ${groups || `<div class="empty">Ingen planlagte arrangementer uten dato akkurat nå.</div>`}</div>`;
}

/* ---------- Ruting ---------- */
const VIEWS = { hjem: viewHjem, sport: viewSport, omrade: viewOmrade, maned: viewManed, sok: viewSok, idretter: viewIdretter, nytt: viewNytt, planlagt: viewPlanlagt, kalender: viewKalender, aret: viewAret, mine: viewMine };
function route() {
  const h = (location.hash || "#hjem").slice(1);
  const name = VIEWS[h] ? h : "hjem";
  document.querySelectorAll(".tabs a").forEach((a) => {
    if (a.dataset.tab === (["sport", "omrade", "maned"].includes(name) ? "hjem" : name)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  VIEWS[name]();
  updateCount();
}
function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); }
function updateCount() {
  const n = myEvents().filter((e) => endOf(e) >= todayIso()).length, el = document.getElementById("mineCount");
  el.textContent = n; el.hidden = !n;
  const nn = recentEvents().filter(isNew).length, ne = document.getElementById("newCount");
  if (ne) { ne.textContent = nn; ne.hidden = !nn; }
}
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}

/* ---------- Hendelser ---------- */
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-calto],[data-act],[data-sport],[data-cal],[data-day],[data-year],[data-group],[data-student],[data-go],[data-clear]");
  if (!el) return;
  if (el.dataset.calto !== undefined) { const [y, m] = el.dataset.calto.split("-").map(Number); CAL.y = y; CAL.m = m; CAL.sel = ""; viewKalender(); return; }
  if (el.dataset.go !== undefined) {
    const i = el.dataset.go.indexOf(":"), k = el.dataset.go.slice(0, i), v = el.dataset.go.slice(i + 1);
    Object.assign(F, F0());
    if (k === "group") F.group = v; else if (k === "region") F.region = v; else if (k === "month") F.month = v;
    else if (k === "board") F.board = true; else if (k === "student") F.student = true; else if (k === "big") F.size = "stor";
    if (location.hash !== "#sok") location.hash = "#sok"; else { viewSok(); window.scrollTo(0, 0); }
    return;
  }
  if (el.dataset.clear !== undefined) { const c = el.dataset.clear; if (c === "board" || c === "student") F[c] = false; else F[c] = ""; if (c === "group") F.sport = ""; viewSok(); return; }
  if (el.dataset.group !== undefined) { F.group = el.dataset.group; F.sport = ""; F.student = false; if (location.hash !== "#sok") location.hash = "#sok"; else { viewSok(); window.scrollTo(0, 0); } return; }
  if (el.dataset.student !== undefined) { F.student = true; F.group = ""; F.sport = ""; if (location.hash !== "#sok") location.hash = "#sok"; else { viewSok(); window.scrollTo(0, 0); } return; }
  if (el.dataset.sport !== undefined) { F.sport = el.dataset.sport; viewSok(); return; }
  if (el.dataset.cal !== undefined) {
    const d = Number(el.dataset.cal);
    if (d === 0) { CAL.y = now0.getFullYear(); CAL.m = now0.getMonth(); } else { const n = new Date(CAL.y, CAL.m + d, 1); CAL.y = n.getFullYear(); CAL.m = n.getMonth(); }
    CAL.sel = ""; viewKalender(); return;
  }
  if (el.dataset.day !== undefined) { CAL.sel = CAL.sel === el.dataset.day ? "" : el.dataset.day; rerender(); return; }
  if (el.dataset.year !== undefined) { YEAR.y += Number(el.dataset.year); viewAret(); window.scrollTo(0, 0); return; }
  const act = el.dataset.act, key = el.dataset.key;
  if (act === "grp-all") { document.querySelectorAll("details.grp").forEach((d) => { d.open = el.dataset.open === "1"; }); return; }
  if (act === "toggle") {
    if (store.joined[key]) { delete store.joined[key]; toast("Fjernet fra mine"); } else { store.joined[key] = "Planlagt"; toast("Lagt til under «Mine»"); }
    save(); rerender();
  } else if (act === "savecontact") {
    const box = el.closest("details"), g = (k) => box.querySelector(`[data-f="${k}"]`).value.trim();
    const c = { name: g("name"), email: g("email"), phone: g("phone") };
    if (c.email && !okEmail(c.email)) { toast("E-postadressen ser ikke riktig ut"); return; }
    if (c.phone && !okPhone(c.phone)) { toast("Telefonnummer kan bare ha tall, +, mellomrom og bindestrek"); return; }
    if (c.name || c.email || c.phone) store.contacts[key] = c; else delete store.contacts[key];
    save(); toast("Kontakt lagret"); rerender();
  } else if (act === "del") {
    delete store.contacts[key];
    store.custom = store.custom.filter((c) => c.id !== key); save(); toast("Slettet"); rerender();
  }
});
document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "showMinor") { store.showSmall = t.checked; save(); rerender(); }
  else if (t.id === "fRegion") { F.region = t.value; updateResults(); }
  else if (t.id === "fSportSel") { F.sport = t.value; updateResults(); }
  else if (t.id === "fSize") { F.size = t.value; updateResults(); }
  else if (t.id === "onlyBoard") { F.board = t.checked; updateResults(); }
  else if (t.id === "onlyStudent") { F.student = t.checked; updateResults(); }
  else if (t.id === "showPast") { F.past = t.checked; updateResults(); }
  else if (t.id === "fMonth") { F.month = t.value; updateResults(); }
  else if (t.dataset.act === "status") {
    const c = store.custom.find((x) => x.id === t.dataset.key);
    if (c) c.status = t.value; else store.joined[t.dataset.key] = t.value;
    save(); rerender();
  }
});
document.addEventListener("input", (ev) => { if (ev.target.id === "q") { F.q = ev.target.value; updateResults(); } });
document.addEventListener("submit", (ev) => {
  if (ev.target.id === "homeSearch") { ev.preventDefault(); Object.assign(F, F0()); F.q = document.getElementById("hq").value.trim(); if (location.hash !== "#sok") location.hash = "#sok"; else viewSok(); return; }
  if (ev.target.id !== "addForm") return;
  ev.preventDefault();
  const v = (id) => document.getElementById(id).value.trim();
  const date = v("fDate"), end = v("fEnd");
  if (end && end < date) { toast("Sluttdato kan ikke være før startdato"); return; }
  const link = v("fLink");
  if (link && !safeUrl(link)) { toast("Lenken må starte med http:// eller https://"); return; }
  const cn = { name: v("fCName"), email: v("fCEmail"), phone: v("fCPhone") };
  if (cn.email && !okEmail(cn.email)) { toast("E-postadressen ser ikke riktig ut"); return; }
  if (cn.phone && !okPhone(cn.phone)) { toast("Telefonnummer kan bare ha tall, +, mellomrom og bindestrek"); return; }
  const cid = "c" + Date.now().toString(36);
  if (cn.name || cn.email || cn.phone) store.contacts[cid] = cn;
  store.custom.push({ id: cid, name: v("fName"), date, end, place: v("fPlace"), region: v("fReg"),
    sport: v("fSport"), status: v("fStatus"), link: safeUrl(link), notes: v("fNotes") });
  save(); toast("Arrangement lagt til"); rerender();
});
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });

/* ---------- Installer som app ---------- */
let deferred;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; installBtn.hidden = false; });
installBtn.addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; installBtn.hidden = true; });
window.addEventListener("appinstalled", () => { installBtn.hidden = true; toast("Appen er installert"); });
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (/iphone|ipad/i.test(navigator.userAgent) && !standalone) document.getElementById("iosHint").hidden = false;
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});

route();
