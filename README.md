# Netflix More Subs

A Chrome extension that adds a second subtitle line below Netflix's original captions, showing a translated copy underneath. Translation comes from one of two engines: the browser's built-in translator, or a local NLLB translation server.

This project started from the assumption that a local NLLB model would translate better than the browser's built-in translator. That assumption turned out to be wrong — in practice, the two produce translations of similar quality.

Even so, the project was worth it: it was a good way to get comfortable with Claude Code, and an enjoyable process overall.

**Status: v0.9.0, personal side project.** A heavily refactored fork of [DeeFrancois/netflix-dual-subs](https://github.com/DeeFrancois/netflix-dual-subs) v1.9, developed independently from the version published on the Chrome Web Store. Credit to the original author for the concept and code (GPL-3.0).

## Translation Engines
- **Browser Translator** (default) — enable Chrome's page translation (right-click → "Translate to …") and the second line is translated automatically. No setup required.
- **Local Server (NLLB)** — the extension translates directly, using `nllb-200-distilled-600M` served locally via CTranslate2. Works without the browser translator and lets you pick the language pair explicitly. Requires a small one-time setup — see "Translation Server" below.

## Features
- Second subtitle line on playback start, episode autoplay, and title changes (stacked or side-by-side layout), with a text stroke outline for legibility against any background
- Extension popup controls: size, color, and opacity for the original and translated lines independently, an on/off toggle, and layout mode. Settings are stored in `chrome.storage.sync` and applied immediately

## Installation (development)
```
npm install
npm run build          # src/ -> dist/
```
`chrome://extensions` → enable Developer mode → "Load unpacked" → select `dist/`. After reloading the extension, **refresh any open Netflix tab** too — otherwise it keeps running the old content script.

## Usage
1. On Netflix, turn on subtitles in the language you're learning.
2. In the extension popup, pick a translation engine:
   - **Browser Translator**: right-click the page → "Translate to …" to enable Chrome's translator.
   - **Local Server (NLLB)**: start the server first (see "Translation Server" below), then set the source/target language and server URL (default `http://127.0.0.1:8008`) in the popup.
3. In the popup, adjust size, color, opacity, and layout for the original and translated lines independently.

## Translation Server (local NLLB)
A local translation server (Python + FastAPI + CTranslate2) under `server/`. It needs an NLLB model
converted to CTranslate2 format, which isn't included — **[server/README.md](server/README.md)**
covers converting the model, installing dependencies, configuration, and the full API.

Once set up:
```
cd server
python -m uvicorn app:app --host 127.0.0.1 --port 8008
```
Check: `curl http://127.0.0.1:8008/health` → `{"status":"ok","model_loaded":true,...}`

## Development
```
npm test               # vitest: unit tests + content script exercised against a fake Netflix player
npm run lint            # eslint
npm run typecheck       # tsc --noEmit
npm run build:dev       # dist/ with source maps and a localhost match (for the fixture page and E2E test bridge)
npm run fixture         # serves test/fixtures/fake-player.html at http://localhost:8787/
```
- Source is TypeScript, under `src/`; `dist/` is the build output. The translation server is Python, under `server/`.
- Docs: [docs/ROADMAP.md](docs/ROADMAP.md) (current status, next steps), [server/README.md](server/README.md) (translation server setup and usage), [docs/NLLB_TRANSLATION.md](docs/NLLB_TRANSLATION.md) (translation server design decisions and integration log), [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) (refactoring plan, decisions, defect history), [docs/SMOKE_CHECKLIST.md](docs/SMOKE_CHECKLIST.md) (live verification checklist), [docs/SMOKE_AUTOMATION.md](docs/SMOKE_AUTOMATION.md) (automation approach).
- Live smoke test: run `/netflix-smoke` in Claude Code — fully automated, including settings changes (requires `npm run build:dev`).
- Working conventions: [CLAUDE.md](CLAUDE.md).

## License
[GPL-3.0](LICENSE). Original work © DeeFrancois, modifications © Junseok Oh.
