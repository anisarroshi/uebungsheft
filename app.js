"use strict";
// Übungsheft, static version. Exercises come from data/*.json; progress is saved in this browser.
const LEVELS = ["A1.1","A1.2","A2.1","A2.2","B1.1","B1.2","B2.1","B2.2","C1.1","C1.2"];
const rank = l => LEVELS.indexOf(l);
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const arr = x => Array.isArray(x) ? x : [];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const canSpeak = "speechSynthesis" in window;

const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const ICON_SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

const state = {
  loaded: false, index: [], full: {}, currentId: null, view: "loading", tab: "sentences",
  pos: { sentences: 0, phrases: 0 }, lists: {}, filter: "all", missedOnly: false, shuffle: false, seed: 1,
  card: null, textDraft: {}, textCompare: {}, confirmReset: false, copied: "", banner: "", micMsg: ""
};

/* ---------- data ---------- */
async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url} couldn't be loaded (${res.status}).`);
  return res.json();
}
const store = {
  get(key, fallback) { try { const v = localStorage.getItem("uebungsheft." + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("uebungsheft." + key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem("uebungsheft." + key); } catch {} }
};
const progressOf = id => store.get("progress." + id, {});
function setProgress(id, key, value) { const p = progressOf(id); p[key] = value; store.set("progress." + id, p); }

/* ---------- answer checking without AI ---------- */
function norm(t) {
  return String(t || "").toLowerCase().normalize("NFC").replace(/ß/g, "ss")
    .replace(/[.,!?;:"„“”‚‘’'«»()\[\]\-–—…]/g, " ").replace(/\s+/g, " ").trim();
}
const loose = t => norm(t).replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
function levenshtein(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function evaluate(answer, item) {
  const refs = [item.de, ...arr(item.alt)];
  const n = norm(answer);
  if (refs.some(r => norm(r) === n)) return { verdict: "correct", closest: refs.find(r => norm(r) === n) };
  let closest = refs[0], best = Infinity;
  for (const r of refs) { const d = levenshtein(norm(r), n); if (d < best) { best = d; closest = r; } }
  if (refs.some(r => loose(r) === loose(answer))) return { verdict: "almost", closest, reason: "Only the umlauts or ß are different. Check them." };
  const len = Math.max(norm(closest).length, 1);
  if (best <= 2 || best / len <= 0.06) return { verdict: "almost", closest, reason: "Very close: a small spelling or ending difference." };
  return { verdict: "unsure", closest, reason: "Your wording is different from the model answer. It may still be correct, because German often allows other word orders or words. Compare, then mark it yourself." };
}
function wordDiff(user, model) {
  const A = String(user).trim().split(/\s+/).filter(Boolean), B = String(model).trim().split(/\s+/).filter(Boolean);
  const nA = A.map(norm), nB = B.map(norm);
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--)
    dp[i][j] = nA[i] && nA[i] === nB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const okA = nA.map(t => !t), okB = nB.map(t => !t);
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (nA[i] && nA[i] === nB[j]) { okA[i] = okB[j] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return {
    user: A.map((t, k) => okA[k] ? esc(t) : `<span class="x">${esc(t)}</span>`).join(" "),
    model: B.map((t, k) => okB[k] ? esc(t) : `<mark>${esc(t)}</mark>`).join(" ")
  };
}

/* ---------- helpers ---------- */
function cur() { return state.full[state.currentId] || null; }
function sortSessions(list) { return list.slice().sort((a, b) => rank(a.level) - rank(b.level) || a.number - b.number); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sayBtn(t) { return canSpeak ? `<button class="icon-btn" data-act="say" data-say="${esc(t)}" aria-label="Listen to the German">${ICON_SPK}</button>` : ""; }
function speak(t) {
  if (!canSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = "de-DE"; u.rate = .95;
  const v = speechSynthesis.getVoices().find(v => /^de/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
const paragraphs = t => String(t || "").split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${esc(p.trim())}</p>`).join("");
async function copyText(text, key) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch {} ta.remove();
  }
  state.copied = key; renderMain();
  setTimeout(() => { if (state.copied === key) { state.copied = ""; renderMain(); } }, 4000);
}

/* ---------- rendering ---------- */
function render() { renderSide(); renderMain(); }
function renderSide() {
  const el = $("#side"); const list = sortSessions(state.index);
  if (!list.length) { el.innerHTML = `<p class="side-empty">${state.loaded ? "Sessions appear here, grouped by level." : "Loading…"}</p>`; return; }
  let html = "";
  for (const L of LEVELS) {
    const g = list.filter(s => s.level === L); if (!g.length) continue;
    html += `<div class="lvl-group"><h3>${L}</h3>` + g.map(s => {
      const p = progressOf(s.id); const done = Object.entries(p).filter(([k, v]) => /^[sp]\d+$/.test(k) && v === "c").length;
      const total = (s.counts?.sentences || 0) + (s.counts?.phrases || 0);
      return `<button class="sess-btn" data-act="open" data-id="${esc(s.id)}" aria-current="${state.view === "session" && s.id === state.currentId}"><span class="t1">Session ${esc(s.number)}${total ? `<span class="t2" style="display:inline">${done}/${total}</span>` : ""}</span><span class="t2">${esc(s.title)}</span></button>`;
    }).join("") + `</div>`;
  }
  el.innerHTML = html;
}
function renderMain() {
  const main = $("#main");
  const a = document.activeElement; const fid = a && a.id && main.contains(a) ? a.id : null;
  let sel = null; if (fid) { try { sel = [a.selectionStart, a.selectionEnd]; } catch {} }
  const sy = window.scrollY;
  let html = state.banner ? `<p class="banner" role="status">${esc(state.banner)}</p>` : "";
  if (state.view === "loading") html += `<p class="muted">Loading your sessions…</p>`;
  else if (state.view === "home") html += homeView();
  else { const s = cur(); html += s ? sessionView(s) : `<p class="muted">Loading session…</p>`; }
  main.innerHTML = html;
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch {} } } }
  window.scrollTo(0, sy);
}
function homeView() {
  return `<div class="empty"><h1>No sessions yet</h1>
  <p class="lead">Upload photos of a course session to Claude and say its level and number, for example "A2.1, session 3". Claude writes the exercises into <code>data/sessions/</code> in this repository. Once they're added, reload this page.</p></div>`;
}
function coveredView(c) {
  if (!c) return "";
  const g = arr(c.grammar), v = arr(c.vocabulary);
  return `<details class="covered"><summary>What this session covers</summary><div class="cov-grid">
    <div><h3>Grammar</h3>${g.length ? `<ul>${g.map(x => `<li><strong>${esc(x.name)}</strong>${x.explanation ? ": " + esc(x.explanation) : ""}</li>`).join("")}</ul>` : '<p class="muted">None listed.</p>'}</div>
    <div><h3>Vocabulary (${v.length})</h3>${v.length ? `<dl class="vocab">${v.map(x => `<dt lang="de">${esc(x.de)}</dt><dd>${esc(x.en)}</dd>`).join("")}</dl>` : '<p class="muted">None listed.</p>'}</div>
  </div></details>`;
}
function sessionView(s) {
  const t = state.tab;
  const tabs = [["sentences", "Sentences", arr(s.sentences).length], ["phrases", "Phrases", arr(s.phrases).length], ["text", "Text", 0]];
  const body = t === "text" ? textView(s) : practiceView(s, t);
  const reset = state.confirmReset
    ? `<span>Clear your progress for this session on this device?</span><button class="btn small danger primary" data-act="reset-yes">Clear progress</button><button class="btn small ghost" data-act="reset-no">Keep it</button>`
    : `<button class="btn small ghost" data-act="reset">Clear progress for this session</button>`;
  return `<p class="lvl-line">${esc(s.level)}, session ${esc(s.number)}</p><h1>${esc(s.title)}</h1>
    ${coveredView(s.content)}
    <div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="tab" role="tab" data-act="tab" data-tab="${k}" aria-selected="${t === k}">${l}${n ? ` <small>${n}</small>` : ""}</button>`).join("")}</div>
    ${body}
    <div class="danger-zone">${reset}</div>`;
}
function getList(s, kind) {
  const items = arr(s[kind]);
  const key = [s.id, kind, state.filter, state.missedOnly, state.shuffle, state.seed].join("|");
  const c = state.lists[kind];
  if (c && c.key === key) return c.list;
  let list = items.map((_, i) => i);
  if (kind === "sentences" && state.filter !== "all") list = list.filter(i => items[i].difficulty === state.filter);
  if (state.missedOnly) { const p = progressOf(s.id); list = list.filter(i => p[kind[0] + i] !== "c"); }
  if (state.shuffle) { const r = rng(state.seed); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } }
  state.lists[kind] = { key, list };
  state.pos[kind] = 0;
  return list;
}
function keysHtml(target) {
  const on = rec && recTarget === target;
  return ["ä","ö","ü","ß","Ä","Ö","Ü"].map(k => `<button class="key" data-act="key" data-k="${k}" data-target="${target}" aria-label="Insert ${k}">${k}</button>`).join("")
    + (SR ? `<button class="btn small mic ${on ? "on" : ""}" data-act="mic" data-target="${target}" aria-pressed="${!!on}">${ICON_MIC}${on ? "Stop" : "Speak"}</button>` : "");
}
function practiceView(s, kind) {
  const items = arr(s[kind]);
  if (!items.length) return `<p class="muted">This session has no ${kind}.</p>`;
  const prog = progressOf(s.id);
  const correct = items.reduce((n, _, i) => n + (prog[kind[0] + i] === "c" ? 1 : 0), 0);
  const list = getList(s, kind);
  const seg = kind === "sentences" ? `<div class="seg" role="group" aria-label="Difficulty">${[["all","All"],["easy","Easy"],["medium","Medium"],["hard","Hard"]].map(([k, l]) => `<button data-act="filter" data-f="${k}" aria-pressed="${state.filter === k}">${l}</button>`).join("")}</div>` : "";
  const toolbar = `<div class="toolbar">${seg}
    <label class="chk"><input type="checkbox" data-act="missed" ${state.missedOnly ? "checked" : ""}>Not yet correct only</label>
    <label class="chk"><input type="checkbox" data-act="shuffle" ${state.shuffle ? "checked" : ""}>Shuffle</label>
    <span class="score">${correct} of ${items.length} correct</span></div>
    <div class="bar" aria-hidden="true"><i style="width:${(correct / items.length * 100).toFixed(1)}%"></i></div>`;
  if (!list.length) return toolbar + `<p class="muted">${state.missedOnly ? "Everything here is marked correct. Nice work." : "Nothing matches this filter."}</p>`;
  const pos = clamp(state.pos[kind], 0, list.length - 1); state.pos[kind] = pos;
  const i = list[pos], it = items[i], key = `${s.id}:${kind}:${i}`;
  if (!state.card || state.card.key !== key) state.card = { key, kind, index: i, status: "idle", answer: "", result: null, selfMark: null };
  const card = state.card, prev = prog[kind[0] + i];
  const prevMark = prev ? `<span class="prev-mark ${prev}">${prev === "c" ? "Correct last time" : prev === "a" ? "Almost last time" : "Missed last time"}</span>` : "";
  const done = card.status !== "idle";
  return toolbar + `<div class="sheet"><span class="n" aria-label="Item ${i + 1}">${i + 1}</span>
    <div class="meta">${kind === "sentences" ? `<span class="chip ${esc(it.difficulty)}">${esc(it.difficulty)}</span>` : ""}${it.focus ? `<span class="focus">${esc(it.focus)}</span>` : ""}${prevMark}</div>
    <p class="prompt" lang="en">${esc(it.en)}</p>
    <label class="sr" for="answer">Your German translation</label>
    <textarea id="answer" class="answer" lang="de" spellcheck="false" autocomplete="off" autocapitalize="sentences" rows="2" placeholder="Auf Deutsch…">${esc(card.answer)}</textarea>
    <div class="tools">${keysHtml("answer")}</div>
    ${state.micMsg ? `<p class="hint" role="status">${esc(state.micMsg)}</p>` : `<p class="hint">Enter checks your answer, then Enter again moves on. Shift+Enter adds a line.</p>`}
    <div class="actions">
      <button class="btn primary" data-act="check">Check</button>
      ${done ? "" : `<button class="btn" data-act="reveal">Show answer</button>`}
      <span class="grow"></span>
      <button class="btn ghost" data-act="prev" ${pos === 0 ? "disabled" : ""}>Previous</button>
      <button class="btn" data-act="next">Next</button>
    </div>
    <div aria-live="polite">${feedbackHtml(s, it, card)}</div>
  </div><p class="pos">${pos + 1} of ${list.length}</p>`;
}
function claudePromptFor(s, it, answer) {
  return `I'm learning German (level ${s.level}). Please check my translation and explain any mistakes briefly.

English: ${it.en}
My German: ${answer || "(I didn't know)"}
Model answer: ${it.de}${arr(it.alt).length ? `\nAlso accepted: ${it.alt.join(" | ")}` : ""}

Is my version correct? If not, what's wrong and which rule applies?`;
}
function selfMarkHtml(card) {
  if (card.selfMark) return `<div class="selfmark"><span>Marked as ${card.selfMark === "c" ? "right" : "not yet"}.</span></div>`;
  return `<div class="selfmark"><span>How did you do?</span><button class="btn small" data-act="self" data-v="c">I had it right</button><button class="btn small ghost" data-act="self" data-v="w">Not yet</button></div>`;
}
function feedbackHtml(s, it, card) {
  if (card.status === "idle") return "";
  const alts = arr(it.alt).length ? `<p class="alts">Also accepted: <span lang="de">${arr(it.alt).map(esc).join("; ")}</span></p>` : "";
  const note = it.note ? `<p class="note">${esc(it.note)}</p>` : "";
  const ask = `<p><button class="linkish" data-act="copy-q">Copy this for Claude</button> ${state.copied === card.key ? `<span class="copied">Copied. Paste it into a Claude chat for an explanation.</span>` : ""}</p>`;
  if (card.status === "revealed") {
    return `<div class="fb">${card.answer ? `<p class="yours">Yours: <span lang="de">${esc(card.answer)}</span></p>` : ""}
      <p class="model"><span class="lbl">Model answer</span><span lang="de" class="de">${esc(it.de)}</span> ${sayBtn(it.de)}</p>${alts}${note}${selfMarkHtml(card)}${ask}</div>`;
  }
  const r = card.result;
  if (r.verdict === "correct") {
    return `<div class="fb correct"><p class="verdict">Richtig!</p>
      <p class="model"><span class="lbl">Model answer</span><span lang="de" class="de">${esc(it.de)}</span> ${sayBtn(it.de)}</p>${alts}${note}</div>`;
  }
  const d = wordDiff(card.answer, r.closest);
  return `<div class="fb ${r.verdict === "almost" ? "almost" : ""}"><p class="verdict">${r.verdict === "almost" ? "Almost there" : "Compare with the model answer"}</p>
    <p>${esc(r.reason)}</p>
    <div class="diff"><span class="lbl">Yours</span><span class="line" lang="de">${d.user}</span><span class="lbl">Model</span><span class="line" lang="de">${d.model} ${sayBtn(r.closest)}</span></div>
    ${r.closest !== it.de ? `<p class="alts">Main model answer: <span lang="de">${esc(it.de)}</span></p>` : alts}${note}
    ${selfMarkHtml(card)}${ask}</div>`;
}
function textView(s) {
  const tx = s.text;
  if (!tx) return `<p class="muted">This session has no text.</p>`;
  if (state.textDraft[s.id] === undefined) state.textDraft[s.id] = store.get("draft." + s.id, "");
  const draft = state.textDraft[s.id];
  const comparing = state.textCompare[s.id];
  const copyKey = "text:" + s.id;
  return `<article class="source" lang="en"><h2>${esc(tx.title || "Text")}</h2>${paragraphs(tx.en)}</article>
  <div class="text-work"><label for="textAnswer">Your German translation</label>
    <textarea id="textAnswer" class="answer text-answer" lang="de" spellcheck="false" placeholder="Schreib hier deine Übersetzung…">${esc(draft)}</textarea>
    <div class="tools">${keysHtml("textAnswer")}</div>
    ${state.micMsg ? `<p class="hint" role="status">${esc(state.micMsg)}</p>` : `<p class="hint">Your draft is saved on this device as you type.</p>`}
    <div class="actions">
      <button class="btn primary" data-act="compare">${comparing ? "Hide comparison" : "Compare with model translation"}</button>
      <button class="btn" data-act="copy-text">Copy for feedback from Claude</button>
      ${state.copied === copyKey ? `<span class="copied">Copied. Paste it into a Claude chat to get your translation marked.</span>` : ""}
    </div>
    ${comparing ? `<div class="compare"><div class="col" lang="de"><h3>Yours</h3>${draft.trim() ? paragraphs(draft) : '<p class="muted">Nothing written yet.</p>'}</div><div class="col" lang="de"><h3>Model translation ${sayBtn(tx.de)}</h3>${paragraphs(tx.de)}</div></div>` : ""}
  </div>`;
}

/* ---------- actions ---------- */
async function openSession(id) {
  if (state.currentId !== id) { state.pos = { sentences: 0, phrases: 0 }; state.lists = {}; state.card = null; state.confirmReset = false; state.micMsg = ""; }
  stopMic();
  state.currentId = id; state.view = "session"; store.set("lastSession", id);
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  render();
  if (!state.full[id]) {
    const entry = state.index.find(x => x.id === id);
    try { state.full[id] = await getJSON("data/" + entry.file); state.banner = ""; }
    catch (e) { state.banner = e.message; }
  }
  render();
}
function curItem() {
  const s = cur(); const kind = state.tab; if (!s || kind === "text" || !state.card) return null;
  return { s, kind, i: state.card.index, it: arr(s[kind])[state.card.index] };
}
function checkAnswer() {
  const c = curItem(); if (!c) return;
  const ans = ($("#answer")?.value || "").trim(); state.card.answer = ans;
  if (!ans) { state.micMsg = "Type or say your translation first."; renderMain(); return; }
  state.micMsg = "";
  const r = evaluate(ans, c.it);
  state.card.status = "checked"; state.card.result = r; state.card.selfMark = null;
  if (r.verdict === "correct") setProgress(c.s.id, c.kind[0] + c.i, "c");
  else if (r.verdict === "almost") setProgress(c.s.id, c.kind[0] + c.i, "a");
  render();
}
function reveal() { if (!state.card) return; state.card.answer = $("#answer")?.value || state.card.answer; state.card.status = "revealed"; renderMain(); }
function selfMark(v) { const c = curItem(); if (!c) return; state.card.selfMark = v; setProgress(c.s.id, c.kind[0] + c.i, v); render(); }
function move(d) {
  const kind = state.tab; const list = state.lists[kind] && state.lists[kind].list; if (!list) return;
  stopMic(); state.micMsg = "";
  let p = state.pos[kind] + d; if (p >= list.length) p = 0; if (p < 0) p = 0;
  state.pos[kind] = p; state.card = null; renderMain();
  const el = $("#answer"); if (el) el.focus();
}
function textFeedbackPrompt(s) {
  return `I'm learning German (level ${s.level}). Please mark my translation of this English text like a supportive, precise teacher. Accept any correct German, not only the model version. Give a score out of 100, list my mistakes with the correction and the rule, and show my text corrected.

ENGLISH:
${s.text.en}

MODEL TRANSLATION (one possible version):
${s.text.de}

MY TRANSLATION:
${state.textDraft[s.id] || "(empty)"}`;
}

/* ---------- speech ---------- */
let rec = null, recTarget = null;
function stopMic() { if (rec) { try { rec.stop(); } catch {} } }
function toggleMic(target) {
  if (!SR) return;
  if (rec) { const same = recTarget === target; stopMic(); if (same) return; }
  const el = document.getElementById(target); if (!el) return;
  const r = new SR(); r.lang = "de-DE"; r.interimResults = true; r.continuous = target === "textAnswer";
  const base = el.value ? el.value.replace(/\s*$/, " ") : "";
  let finalText = "";
  r.onresult = e => {
    let interim = "";
    for (let k = e.resultIndex; k < e.results.length; k++) { const x = e.results[k]; if (x.isFinal) finalText += x[0].transcript.trim() + " "; else interim += x[0].transcript; }
    const t = document.getElementById(target);
    if (t) { t.value = (base + finalText + interim).trimStart(); t.dispatchEvent(new Event("input", { bubbles: true })); }
  };
  r.onerror = e => {
    state.micMsg = (e.error === "not-allowed" || e.error === "service-not-allowed")
      ? "The microphone is blocked. Allow it in the browser's address bar, or use your device's built-in German dictation."
      : e.error === "no-speech" ? "No speech heard. Tap Speak and try again." : "Speech input stopped (" + e.error + ").";
  };
  r.onend = () => { if (rec === r) { rec = null; recTarget = null; } renderMain(); };
  try { r.start(); rec = r; recTarget = target; state.micMsg = "Listening… speak German."; }
  catch { state.micMsg = "Speech input couldn't start in this browser."; }
  renderMain();
}

/* ---------- events ---------- */
document.addEventListener("mousedown", e => { if (e.target.closest("[data-act='key']")) e.preventDefault(); });
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const s = cur();
  switch (t.dataset.act) {
    case "open": openSession(t.dataset.id); break;
    case "tab": stopMic(); state.tab = t.dataset.tab; state.card = null; state.micMsg = ""; renderMain(); break;
    case "filter": state.filter = t.dataset.f; state.card = null; renderMain(); break;
    case "missed": state.missedOnly = t.checked; state.card = null; state.lists = {}; renderMain(); break;
    case "shuffle": state.shuffle = t.checked; state.seed = Math.floor(Math.random() * 1e9); state.card = null; renderMain(); break;
    case "check": checkAnswer(); break;
    case "reveal": reveal(); break;
    case "next": move(1); break;
    case "prev": move(-1); break;
    case "self": selfMark(t.dataset.v); break;
    case "say": speak(t.dataset.say); break;
    case "mic": toggleMic(t.dataset.target); break;
    case "key": {
      const el = document.getElementById(t.dataset.target); if (!el) break;
      const ch = t.dataset.k, st = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? st;
      el.value = el.value.slice(0, st) + ch + el.value.slice(en); el.focus(); el.setSelectionRange(st + ch.length, st + ch.length);
      el.dispatchEvent(new Event("input", { bubbles: true })); break;
    }
    case "copy-q": { const c = curItem(); if (c) copyText(claudePromptFor(c.s, c.it, state.card.answer), state.card.key); break; }
    case "copy-text": if (s) copyText(textFeedbackPrompt(s), "text:" + s.id); break;
    case "compare": if (s) { state.textCompare[s.id] = !state.textCompare[s.id]; renderMain(); } break;
    case "reset": state.confirmReset = true; renderMain(); break;
    case "reset-no": state.confirmReset = false; renderMain(); break;
    case "reset-yes": if (s) { store.remove("progress." + s.id); state.confirmReset = false; state.lists = {}; state.card = null; render(); } break;
  }
});
let draftTimer = null;
document.addEventListener("input", e => {
  const el = e.target; const s = cur();
  if (el.id === "answer" && state.card) state.card.answer = el.value;
  if (el.id === "textAnswer" && s) {
    state.textDraft[s.id] = el.value;
    clearTimeout(draftTimer); draftTimer = setTimeout(() => store.set("draft." + s.id, el.value), 400);
  }
});
document.addEventListener("keydown", e => {
  if (e.target.id === "answer" && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (state.card && state.card.status !== "idle") move(1); else checkAnswer();
  }
});
window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id && id !== state.currentId && state.index.some(x => x.id === id)) openSession(id); });

/* ---------- start ---------- */
(async function init() {
  render();
  try {
    state.index = arr((await getJSON("data/sessions.json")).sessions);
    state.loaded = true;
    const fromHash = location.hash.slice(1);
    const last = store.get("lastSession", null);
    const pick = [fromHash, last].find(id => id && state.index.some(x => x.id === id)) || (sortSessions(state.index).pop() || {}).id;
    if (pick) await openSession(pick); else { state.view = "home"; render(); }
  } catch (e) {
    state.loaded = true; state.view = "home";
    state.banner = location.protocol === "file:"
      ? "Open the app through a web server: run npm start in the project folder, or use GitHub Pages. Opening index.html directly from disk doesn't work."
      : e.message;
    render();
  }
})();
