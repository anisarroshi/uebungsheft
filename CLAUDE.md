# How to add a session to Übungsheft

This file is for Claude (in a chat, Claude Code, or any other tool). Follow it exactly whenever the learner uploads photos of a German course session and gives its level and number, for example "A2.1, session 3".

The app has no server and no API key. Each session is one JSON file in `data/sessions/`. The app lists sessions from `data/sessions.json`, which `npm run check` rebuilds.

## Steps

1. **Read the earlier sessions first.** Open every file in `data/sessions/` whose level is lower than the new one, or the same level with a lower session number. Their `content` (vocabulary and grammar) is the review material for the new session. If you can't see the repository, ask the learner for the repository link or the earlier session files before writing anything.
2. **Read the photos carefully.** Extract the session's topics, every vocabulary item you can see (nouns with article and plural if shown), the grammar points, and useful expressions. Don't guess words that aren't legible; ask instead.
3. **Write the exercises** following the rules below.
4. **Save the file** as `data/sessions/<id>.json`.
5. **Run `npm run check`** if you can run commands. Fix every error and aim for zero warnings. It also rebuilds `data/sessions.json`. If you can't run commands, also produce an updated `data/sessions.json` (format below).
6. **Commit** with the message `Add A2.1 session 3: <title>`.
7. **Never commit the photos.** Course book pages are copyrighted. Only the generated JSON goes into the repository (`photos/` is in `.gitignore`).

## File name and id

`id` = level in lowercase with the dot replaced by a dash, then `-s` and the session number with two digits.
A2.1 session 3 → `a2-1-s03`, file `data/sessions/a2-1-s03.json`.

## Rules for the exercises

**Level.** Keep grammar and vocabulary within the CEFR level of the session, plus anything the session or earlier sessions teach. Never require structures from a higher level. The German must be correct, natural standard German that a learner at that level can produce.

**Review.** About 70% of sentences practise the new session. About 30% recycle earlier sessions' vocabulary and grammar. Phrases: about 20% recycle earlier material. If there are no earlier sessions, use only the new one. The higher the level, the more earlier grammar the hard sentences combine.

**100 sentences**, in this order: 35 easy, then 40 medium, then 25 hard.
- easy: 4–8 words, one main structure, mostly this session's words.
- medium: 7–13 words, combines two structures or several new words; may use connectors known at this level.
- hard: 10–20 words, combines this session's grammar with earlier sessions (word order changes, cases, tenses, connectors the learner knows).
- Vary persons (ich, du, er, sie, wir, ihr, Sie), statements, questions, negation and everyday situations. No duplicates, and don't test the same thing the same way twice.
- Where the English "you" is ambiguous, add a hint in square brackets at the end: `[informal]`, `[formal]` or `[plural]`.

**50 phrases**: 2–8 words, not full-length sentences. Fixed expressions, collocations, useful questions, reactions and chunks tied to the session.

**Text**: one connected English text, in 3–5 paragraphs separated by a blank line (`\n\n`), whose German translation uses the session's vocabulary and grammar a lot, with some review. Choose a form that suits the topic: short story, email, diary entry or short article. Length by level: A1 80–120 words, A2 120–170, B1 170–240, B2 240–320, C1 320–400. Include a model German translation with the same paragraphs.

**Alternatives matter.** The app checks answers without AI, by comparing them with `de` and `alt`. For every sentence and phrase, add the other common correct German versions to `alt` (different word order, synonyms, du/Sie variants where no hint is given, contractions like "ins"/"in das"). Up to 3. This is what makes checking fair.

**focus**: a 2–5 word label of what the item tests, e.g. "Perfekt with sein", "dative after mit".

**note** (phrases only, optional): a very short English usage note.

## JSON format

```json
{
  "id": "a2-1-s03",
  "level": "A2.1",
  "number": 3,
  "title": "At the train station",
  "createdAt": "2026-09-16",
  "content": {
    "topics": ["travel", "tickets"],
    "vocabulary": [{ "de": "der Bahnhof, -¨e", "en": "train station" }],
    "grammar": [{ "name": "Perfekt with sein", "explanation": "Verbs of movement form the Perfekt with sein.", "examples": ["Ich bin nach Wien gefahren."] }],
    "expressions": [{ "de": "Einmal nach Graz, bitte.", "en": "One ticket to Graz, please." }]
  },
  "sentences": [
    { "en": "I went to Vienna by train.", "de": "Ich bin mit dem Zug nach Wien gefahren.", "alt": ["Ich bin nach Wien mit dem Zug gefahren."], "difficulty": "easy", "focus": "Perfekt with sein" }
  ],
  "phrases": [
    { "en": "a return ticket", "de": "eine Hin- und Rückfahrkarte", "alt": [], "focus": "tickets", "note": "" }
  ],
  "text": {
    "title": "A day trip",
    "en": "First paragraph.\n\nSecond paragraph.",
    "de": "Erster Absatz.\n\nZweiter Absatz."
  }
}
```

`data/sessions.json` (rebuilt by `npm run check`; sorted by level, then number):

```json
{
  "sessions": [
    { "id": "a2-1-s03", "level": "A2.1", "number": 3, "title": "At the train station", "file": "sessions/a2-1-s03.json", "counts": { "sentences": 100, "phrases": 50 } }
  ]
}
```
