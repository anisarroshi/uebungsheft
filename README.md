# Übungsheft

German translation practice built from your course sessions. For every session there are 100 sentences, 50 phrases and a text to translate from English into German, by typing or speaking.

There is **no server code, no database and no API key**. Claude writes the exercises once from photos of the session and saves them as JSON files in this repository. The app only reads those files.

## Adding a session

1. Give Claude photos of the session and say its level and number, for example "A2.1, session 3".
2. Claude follows [`CLAUDE.md`](CLAUDE.md): it reads the earlier sessions for review, then writes `data/sessions/a2-1-s03.json`.
3. Run `npm run check` (or let Claude run it). It validates the files and rebuilds `data/sessions.json`.
4. Commit and push. Photos are never committed, because course book pages are copyrighted.

## Using the app

**Locally** (needs [Node.js](https://nodejs.org) 20+; nothing to install):

```bash
npm start
```

Then open http://localhost:3000. Opening `index.html` directly from disk doesn't work, because browsers block loading the JSON files that way.

**Online and on your phone**: turn on GitHub Pages (repository **Settings → Pages → Deploy from a branch → main / root**). The app then runs at `https://<your-username>.github.io/<repository>/` and updates whenever you push a new session. You can add it to your phone's home screen from the browser menu.

## How answers are checked

Without AI, the app compares your answer with the model answer and the accepted alternatives in each file:

- **Correct**: matches one of them, ignoring capitals, punctuation and ß/ss.
- **Almost**: only umlauts or a letter or two are different.
- **Compare**: your wording differs. The app highlights which words differ, and you mark it yourself, because your version may also be right.

For a real explanation, "Copy this for Claude" copies a ready-made question you can paste into a Claude chat. The text tab has the same button to get your whole translation marked.

Progress and text drafts are saved in the browser, so each device keeps its own progress.

Speaking works best in Chrome or Edge.

## Files

```
index.html, styles.css, app.js   the app
data/sessions.json              list of sessions (rebuilt by npm run check)
data/sessions/<id>.json         one file per session, with all exercises
CLAUDE.md                       rules Claude follows to create a session
tools/check.js                  validator and index builder
serve.js                        small local web server for npm start
```
