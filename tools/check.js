// Checks every file in data/sessions/ and rebuilds data/sessions.json (the list the app loads).
// Run after adding or changing a session:  npm run check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "sessions");
const LEVELS = ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2", "C1.1", "C1.2"];
const errors = [];
const warnings = [];
const isStr = (x) => typeof x === "string" && x.trim().length > 0;
const expectedId = (level, number) => `${level.toLowerCase().replace(".", "-")}-s${String(number).padStart(2, "0")}`;

const sessions = [];
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const where = `data/sessions/${file}`;
  let s;
  try {
    s = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  } catch (e) {
    errors.push(`${where}: not valid JSON (${e.message})`);
    continue;
  }
  const err = (m) => errors.push(`${where}: ${m}`);
  const warn = (m) => warnings.push(`${where}: ${m}`);

  if (!LEVELS.includes(s.level)) err(`level must be one of ${LEVELS.join(", ")}`);
  if (!Number.isInteger(s.number) || s.number < 1) err("number must be a whole number of 1 or more");
  if (LEVELS.includes(s.level) && Number.isInteger(s.number)) {
    const id = expectedId(s.level, s.number);
    if (s.id !== id) err(`id should be "${id}"`);
    if (file !== `${id}.json`) err(`file should be named ${id}.json`);
  }
  if (!isStr(s.title)) err("title is missing");

  const c = s.content || {};
  if (!Array.isArray(c.vocabulary) || !Array.isArray(c.grammar)) err("content.vocabulary and content.grammar must be lists");
  else {
    c.vocabulary.forEach((v, i) => { if (!isStr(v.de) || !isStr(v.en)) err(`content.vocabulary[${i}] needs "de" and "en"`); });
    c.grammar.forEach((g, i) => { if (!isStr(g.name)) err(`content.grammar[${i}] needs "name"`); });
  }

  const checkItems = (key, expected) => {
    const list = s[key];
    if (!Array.isArray(list)) return err(`${key} must be a list`);
    if (list.length !== expected) warn(`${key} has ${list.length} items (expected ${expected})`);
    const seen = new Set();
    list.forEach((it, i) => {
      if (!isStr(it.en) || !isStr(it.de)) err(`${key}[${i}] needs "en" and "de"`);
      if (it.alt !== undefined && (!Array.isArray(it.alt) || it.alt.some((a) => !isStr(a)))) err(`${key}[${i}].alt must be a list of strings`);
      if (key === "sentences" && !["easy", "medium", "hard"].includes(it.difficulty)) err(`sentences[${i}].difficulty must be easy, medium or hard`);
      const k = String(it.en || "").toLowerCase().trim();
      if (seen.has(k)) warn(`${key}[${i}] repeats an earlier English prompt`);
      seen.add(k);
    });
    if (key === "sentences") {
      const count = (d) => list.filter((x) => x.difficulty === d).length;
      const got = `${count("easy")}/${count("medium")}/${count("hard")}`;
      if (got !== "35/40/25") warn(`difficulty split is ${got} (expected 35/40/25 easy/medium/hard)`);
    }
  };
  checkItems("sentences", 100);
  checkItems("phrases", 50);
  if (!s.text || !isStr(s.text.en) || !isStr(s.text.de)) err('text needs "title", "en" and "de"');

  sessions.push({
    id: s.id, level: s.level, number: s.number, title: s.title, file: `sessions/${file}`,
    counts: { sentences: (s.sentences || []).length, phrases: (s.phrases || []).length },
  });
}

const dupes = new Map();
for (const s of sessions) {
  const k = `${s.level} session ${s.number}`;
  if (dupes.has(k)) errors.push(`${k} exists twice: ${dupes.get(k)} and ${s.file}`);
  dupes.set(k, s.file);
}

sessions.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.number - b.number);
fs.writeFileSync(path.join(ROOT, "data", "sessions.json"), JSON.stringify({ sessions }, null, 2) + "\n");

for (const w of warnings) console.log("warning  " + w);
for (const e of errors) console.log("error    " + e);
console.log(`\n${sessions.length} session(s) listed in data/sessions.json. ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
