---
name: netflix-smoke
description: Run the live-Netflix smoke test for the Dual Subtitles extension by driving the user's logged-in Chrome with the claude-in-chrome tools, then report a checklist. Use when the user asks to run the smoke test, "스모크 돌려줘", or to verify the built extension on real Netflix.
---

# Netflix live smoke test

Drives the user's real, logged-in Chrome (claude-in-chrome MCP) through `docs/SMOKE_CHECKLIST.md`
and reports pass/fail per item. Judgement is done by `scripts/smoke/page-checks.js` running inside
the page — never by eyeballing screenshots. The browser translator is **not** required: both
containers may show the same text; what is verified is the `translate` flags, mirroring, placement.

Optional argument: a `/watch/` URL to use instead of the default title.

## Fixed facts (from previous runs)
- Default title: episode 2 `https://www.netflix.com/watch/80014299?t=510` (dinner scene from 8:30 —
  subtitles appear within seconds). Episode 1 `https://www.netflix.com/watch/80014298?t=1320` (22:00).
  Seeking episode 1 to its end autoplays into episode 2.
- Subtitles are English CC. Mirror text equals original text when the translator is off.
- Unpacked extension ID on this machine: `cdnihchamhefhfomhiogidadbcgpmkib`.
- The claude-in-chrome tool **cannot open `chrome-extension://` URLs**, so the popup cannot be
  driven by tools. Settings checks (E) need the user to click the popup; verification is automatic.
- Screenshots on Netflix pages usually time out ("Script injection timed out"). Do not retry more
  than once; everything needed comes back from `javascript_tool`.
- `read_console_messages` only records from its first call onward — call it right after the first
  navigation so page-load errors are captured.
- Any `navigate` reloads the page and wipes `window.__dsubsCheck`; re-inject after every navigate.
  Autoplay is an in-app route change and keeps it.

## Before starting
1. Confirm the user has built and loaded the extension: `npm run build`, then in
   `chrome://extensions` reload the unpacked `dist/`. Any already-open Netflix tab must be refreshed
   or it keeps the old content script.
2. Load tools in ONE call:
   `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__tabs_close_mcp")`
3. Generate the injectable checker from the repo (keeps the skill in sync with the code):
   `npm run -s smoke:snippet -- --define` → prints `window.__dsubsCheck = function ...;`.
   Paste that output verbatim at the top of the javascript_tool calls marked **[inject]** below.

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
has no dialogue — seek elsewhere (`?t=`) rather than declaring failure.

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

### 6. Settings (E) — user clicks, tool verifies
Ask the user to change controls in the extension popup, one round at a time, then run the check with
matching expectations. Colors come back as `rgb(r, g, b)`.

| Round | Ask the user to set | Verify with |
|---|---|---|
| 1 | Translation Color `#FF0000`, Original Color `#00FF00`, Size `1.5`, Enable **OFF** | `{ mirrorColor: 'rgb(255, 0, 0)', originalColor: 'rgb(0, 255, 0)', fontMultiplier: 1.5, hidden: true }` |
| 2 | Enable **ON**, Stacked **OFF** | `{ hidden: false, mode: 'side-by-side' }` — B3 must pass in side-by-side |
| 3 | Stacked **ON**, then **Reset Settings** | `{ mirrorColor: 'rgb(255, 255, 255)', originalColor: 'rgb(255, 240, 0)', fontMultiplier: 1, mirrorOpacity: 0.8, mode: 'stacked' }` |

Note: Reset does not touch on/off or stacked (by design). Round 3 leaves the user's appearance
settings at defaults — say so, and offer to restore the values captured in step 1 if they differed.

### 7. Clean up (always, even on failure)
```js
try { const vp = netflix.appContext.state.playerApp.getAPI().videoPlayer; vp.getVideoPlayerBySessionId(vp.getAllPlayerSessionIds()[0]).pause(); } catch {}
'paused'
```
Then `navigate` the tab to `https://www.netflix.com/browse` and close the tab with `tabs_close_mcp`.
Never leave the user's Netflix playing.

## Report
Print one table: checklist item → 통과/실패/미실행, with the numeric evidence that matters
(gap px, font ratio, changes count, first-subtitle delay after autoplay). List every failed check
with its `detail`. Then offer to update the "마지막 실행" line in `docs/SMOKE_CHECKLIST.md` and to
record the run in the current phase document under `docs/`.

Items this skill cannot cover and must be reported as 미실행: E-11 (browser restart persistence),
G (Edge), visual quality beyond geometry.
