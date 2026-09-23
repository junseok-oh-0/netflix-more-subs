---
name: netflix-smoke
description: Run the live-Netflix smoke test for the Netflix More Subs extension by driving the user's logged-in Chrome with the claude-in-chrome tools, then report a checklist. Use when the user asks to run the smoke test, "스모크 돌려줘", or to verify the built extension on real Netflix.
---

# Netflix live smoke test

Drives the user's real, logged-in Chrome (claude-in-chrome MCP) through `docs/SMOKE_CHECKLIST.md`
and reports pass/fail per item. Judgement is done by `scripts/smoke/page-checks.js` running inside
the page — never by eyeballing screenshots. The browser translator is **not** required: both
containers may show the same text; what is verified is the `translate` flags, mirroring, placement.

**Settings (E) are fully automated too** — no popup clicks needed — via a dev-build-only
`window.postMessage` bridge in content.ts. See "E2E bridge" below. Full detail:
`docs/SMOKE_AUTOMATION.md`.

Optional argument: a `/watch/` URL to use instead of the default title.

## Fixed facts (from previous runs)
- Default title: episode 2 `https://www.netflix.com/watch/80014299?t=510` (dinner scene from 8:30 —
  subtitles appear within seconds). Episode 1 `https://www.netflix.com/watch/80014298?t=1320` (22:00).
  Seeking episode 1 to its end autoplays into episode 2.
- Subtitles are English CC. Mirror text equals original text in browser-translator mode.
- Unpacked extension ID on this machine: `cdnihchamhefhfomhiogidadbcgpmkib`.
- Screenshots on Netflix pages usually time out ("Script injection timed out"). Do not retry more
  than once; everything needed comes back from `javascript_tool`.
- `read_console_messages` only records from its first call onward — call it right after the first
  navigation so page-load errors are captured.
- Any `navigate` reloads the page and wipes `window.__dsubsCheck`/`__dsubsSet`; re-inject after
  every navigate. Autoplay is an in-app route change and keeps them.
- Netflix occasionally lands in a broken state after navigate/reload — no `<video>` element, zero
  console output ever, only stray unrelated DOM ("Back Button"/"Filter Button" text) visible. A
  fresh tab or a manual refresh clears it. If 2-3 retries don't fix it, stop and ask the user to
  look at the actual window — this can look identical to a tool-side problem.
- Dual Subtitles OFF hides the mirror and leaves the original untouched (no `translate="no"`,
  no forced color) — this is intentional, not a bug. `runPageChecks` detects this
  (`mirror.style.display === 'none'`) and skips A3/A4/B1-B4/E-font-multiplier automatically.

## E2E bridge (settings automation)
`javascript_tool` runs in the page's **main world**; `chrome.storage` only exists in extension
contexts (content script's **isolated world**, popup, background) — confirmed `chrome.storage` is
`undefined` from `javascript_tool`. `chrome-extension://` pages (the popup) can't be opened by
automation tools either. So settings are driven through a dev-build-only bridge in `content.ts`:
`window.postMessage({source:'dsubs-e2e', type:'set-preference', key, value}, '*')` →
an isolated-world listener calls the exact same `savePreference()` the popup uses.

This bridge is compiled out of production builds (`__DSUBS_E2E__` is a literal `false` via esbuild
`define` in `npm run build`; the listener is never registered). Using it requires:
1. `npm run build:dev` once (adds ` (dev)` to the extension name in `chrome://extensions`)
2. **Ask the user** to reload the extension in `chrome://extensions` — that page can't be opened
   by this tool, so this one click is unavoidable. (If they closed the Netflix tab, open a fresh
   one yourself; don't ask them to do more than the extensions-page reload.)
3. Inject the checker **and** this helper together:
   ```js
   window.__dsubsSet = (key, value) => window.postMessage({ source: 'dsubs-e2e', type: 'set-preference', key, value }, '*');
   ```
4. `window.__dsubsSet('text_color', '#FF0000')`, wait ~500ms, then verify with `window.__dsubsCheck`
5. **When done, rebuild production** (`npm run build`) and ask the user to reload the extension
   again — never leave the dev (bridge-enabled, unminified, 3-4x larger) build as their daily driver.

## Before starting
1. Confirm the user has built and loaded the extension. For settings automation, that means
   `npm run build:dev`; for a plain functional check, plain `npm run build` is enough. Either way,
   ask the user to reload the unpacked extension in `chrome://extensions` (cannot be automated) and
   refresh/reopen any Netflix tab.
2. Load tools in ONE call:
   `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__tabs_close_mcp")`
3. Generate the injectable checker from the repo (keeps the skill in sync with the code):
   `npm run -s smoke:snippet -- --define` → prints `window.__dsubsCheck = function ...;`.
   Paste that output verbatim at the top of the javascript_tool calls marked **[inject]** below,
   followed by the `window.__dsubsSet` one-liner from "E2E bridge" above if settings will be tested.

## Procedure
Use `tabs_context_mcp{createIfEmpty:true}`, create a new tab, and work only in that tab.

### 1. Enter the player and wait for a subtitle (A)
- `navigate` to the title URL. Immediately call `read_console_messages` (onlyErrors, pattern
  `content\.js|dsubs|my-timedtext|TypeError|ReferenceError|Uncaught`) once to start tracking.
- **[inject]** then run:
```js
const t0 = Date.now(); let r = null;
while (Date.now() - t0 < 30000) { r = window.__dsubsCheck(document, { mode: 'stacked' }); if (r.checks.find(c => c.id.startsWith('B0'))?.pass) break; await new Promise(x => setTimeout(x, 400)); }
({ href: location.href, ok: r.ok, failed: r.checks.filter(c => !c.pass), text: r.checks.find(c => c.id.startsWith('B1'))?.detail, b3: r.checks.find(c => c.id.startsWith('B3'))?.detail, style: r.checks.find(c => c.id.startsWith('S '))?.detail })
```
Pass: `ok: true`. Record `style` (current colors/opacity/font ratio — the user's live settings).
If `mode` was not stacked the user has Stacked Subtitles off; pass `{ mode: 'side-by-side' }` instead.
If `video`/`timedtext` never appear within ~15s, see the "Netflix occasionally lands in a broken
state" fixed fact above before assuming a real failure.

### 2. Subtitle flow for 15 s (B-1, B-2)
```js
const t0 = Date.now(); const samples = []; let last = null;
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
while (Date.now() - t0 < 15000) {
  const o = norm(document.querySelector('.player-timedtext')?.innerText);
  const m = norm(document.querySelector('.my-timedtext-container')?.innerText);
  const key = o + '|' + m;
  if (key !== last) { const r = window.__dsubsCheck(document); samples.push({ t: Date.now() - t0, o: o.slice(0, 50), m: m.slice(0, 50), match: o === m, failed: r.checks.filter(c => !c.pass && !c.id.startsWith('B0')).map(c => c.id) }); last = key; }
  await new Promise(r => setTimeout(r, 200));
}
({ changes: samples.length - 1, mismatches: samples.filter(s => !s.match), lingering: samples.filter(s => s.o === '' && s.m !== ''), failedAny: samples.filter(s => s.failed.length) })
```
Pass: `changes ≥ 2`, `mismatches`, `lingering`, `failedAny` all empty. If `changes` is 0 the scene
has no dialogue — seek elsewhere (`?t=`) rather than declaring failure. Note: in local translation
mode `mismatches` is expected to be non-empty (mirror shows a translation, not the original) — only
check `failedAny` there.

### 3. Resize (F)
`resize_window` to 1000×700, then:
```js
await new Promise(r => setTimeout(r, 1500));
const t0 = Date.now(); let r = null;
while (Date.now() - t0 < 10000) { r = window.__dsubsCheck(document, { mode: 'stacked' }); if (r.checks.find(c => c.id.startsWith('B0'))?.pass) break; await new Promise(x => setTimeout(x, 300)); }
({ win: { innerWidth, innerHeight }, ok: r.ok, failed: r.checks.filter(c => !c.pass), b3: r.checks.find(c => c.id.startsWith('B3'))?.detail, style: r.checks.find(c => c.id.startsWith('S '))?.detail })
```
Pass: `ok: true`, gap still ≈ 8, mirror/original font ratio unchanged from step 1.
Restore the window to its previous size (read `outerWidth`/`outerHeight` first if unknown; 1920×1050 on this machine).

### 4. Autoplay into the next episode (C-1)
Side effect: marks the current episode as watched. Tell the user once.
```js
const vp = netflix.appContext.state.playerApp.getAPI().videoPlayer;
const p = vp.getVideoPlayerBySessionId(vp.getAllPlayerSessionIds()[0]);
const startHref = location.href; const startTimedtext = document.querySelector('.player-timedtext');
p.seek(p.getDuration() - 6000);
const t0 = Date.now(); const events = [];
while (Date.now() - t0 < 25000) {
  const btn = document.querySelector('[data-uia="next-episode-seamless-button"], [data-uia="next-episode-seamless-button-draining"]');
  if (btn && !events.includes('clicked-next')) { btn.click(); events.push('clicked-next'); }
  if (location.href !== startHref) { events.push('url-changed@' + (Date.now() - t0)); break; }
  await new Promise(r => setTimeout(r, 400));
}
({ events, href: location.href, timedtextReplaced: document.querySelector('.player-timedtext') !== startTimedtext, mirrors: document.querySelectorAll('.my-timedtext-container').length })
```
Then repeat the step-1 wait/check loop (no re-inject needed; wait up to 40 s — new episodes open on a
recap). Pass: URL changed, `timedtextReplaced: true`, `mirrors: 1`, check `ok: true`,
`document.querySelectorAll('#dsubs-single-line').length === 1`.

### 5. Re-enter another title (C-2)
`navigate` back to the other episode URL, **[inject]** again, run the step-1 loop. Pass: `ok: true`.
Read `read_console_messages` again here (A-3): pass when nothing extension-related is listed.

### 6. Settings (E) — fully automated via the E2E bridge
Requires the dev build + bridge helper injected (see "E2E bridge" above — ask the user once to
reload the extension if not already on the dev build). No popup interaction needed.

```js
window.__dsubsSet('text_color', '#FF0000');
window.__dsubsSet('originaltext_color', '#00FF00');
window.__dsubsSet('font_multiplier', '1.5');
window.__dsubsSet('on_off', false);
await new Promise(r => setTimeout(r, 800));
const r = window.__dsubsCheck(document, { mirrorColor: 'rgb(255, 0, 0)', fontMultiplier: 1.5, hidden: true });
({ ok: r.ok, failed: r.checks.filter(c => !c.pass) })
```

| Round | Set | Verify with |
|---|---|---|
| 1 | `text_color='#FF0000'`, `originaltext_color='#00FF00'`, `font_multiplier='1.5'`, `on_off=false` | `{ mirrorColor: 'rgb(255, 0, 0)', fontMultiplier: 1.5, hidden: true }` (no `originalColor` — off forces it white, that's correct) |
| 2 | `on_off=true`, `button_up_down_mode=false` | `{ hidden: false, mode: 'side-by-side' }` |
| 3 | `button_up_down_mode=true`, then reset the appearance keys individually: `font_multiplier=1`, `opacity=0.8`, `originaltext_opacity=1`, `text_color='#FFFFFF'`, `originaltext_color='#fff000'` | `{ mirrorColor: 'rgb(255, 255, 255)', originalColor: 'rgb(255, 240, 0)', fontMultiplier: 1, mirrorOpacity: 0.8, mode: 'stacked' }` |

Note: `on_off`/`button_up_down_mode` don't have a "reset" — the popup's Reset button only touches
appearance, matched above by setting each key back individually. Values sent through
`__dsubsSet` go through the same `normalizeValue()` as the popup, so type coercion (e.g. `'1.5'` →
`1.5`) works the same way.

### 7. Local translation mode (only if the user has the server running)
Ask first — don't start the server yourself. If it's up:
```js
window.__dsubsSet('translator', 'local');
window.__dsubsSet('sourceLang', 'eng_Latn');
window.__dsubsSet('targetLang', 'kor_Hang');
window.__dsubsSet('localServerUrl', 'http://127.0.0.1:8008');
```
Then repeat the step-2 sampling loop. Pass criteria differ from browser mode:
- Each sample's `m` starts equal to `o` (shown immediately) and a later sample for the *same*
  original line shows a **different, translated** `m` (Korean text if `targetLang` is `kor_Hang`)
- `translate` on the mirror is `'no'` throughout (check via `document.querySelector('.my-timedtext-container').getAttribute('translate')`)
- No extension errors in `read_console_messages` (background fetch failures surface as the mirror
  simply staying on the original text — not a thrown error — so also eyeball a few samples for
  Hangul/translated content, not just error-free)

When done, `window.__dsubsSet('translator', 'browser')` to leave the extension in its default state.

### 8. Clean up (always, even on failure)
```js
try { const vp = netflix.appContext.state.playerApp.getAPI().videoPlayer; vp.getVideoPlayerBySessionId(vp.getAllPlayerSessionIds()[0]).pause(); } catch {}
'paused'
```
Then `navigate` the tab to `https://www.netflix.com/browse` and close the tab with `tabs_close_mcp`.
Never leave the user's Netflix playing. **If a dev build was loaded for this run**, rebuild
production (`npm run build`) and ask the user to reload the extension once more before finishing.

## Report
Print one table: checklist item → 통과/실패/미실행, with the numeric evidence that matters
(gap px, font ratio, changes count, first-subtitle delay after autoplay). List every failed check
with its `detail`. Then offer to update the "마지막 실행" line in `docs/SMOKE_CHECKLIST.md` and to
record the run in the current phase document under `docs/`.

Items this skill cannot cover and must be reported as 미실행: E-11 (browser restart persistence),
G (Edge), visual quality beyond geometry.
