# 스모크 자동화 (Phase 7)

`docs/SMOKE_CHECKLIST.md`의 수동 항목을 실제 Netflix에서 자동으로 확인한다. **설정(E) 포함 전체가 완전 자동** — 사람이 팝업을 클릭할 필요가 없다 (2026-09-24, 아래 "E2E 테스트 브리지" 참고).

## 원칙
- **브라우저 번역기는 검증 대상이 아니다.** 번역은 브라우저 몫이므로 두 컨테이너에 같은 원문이 떠도 된다. 확장이 책임지는 것은 (1) 원본 컨테이너 `translate="no"`, (2) 미러 컨테이너의 `translate` 플래그가 모드에 맞는지(브라우저 모드 `yes`, 로컬 모드 `no`), (3) 미러링·배치. 이 덕분에 "항상 번역" 설정 같은 전제가 없다.
- **Dual Subtitles가 꺼져 있을 때는 미러/원본 비교 검사를 건너뛴다.** 꺼지면 미러는 숨겨지고(stale 상태), 원본은 확장이 손대지 않은 채로 남는다(의도된 동작 — 꺼지면 페이지에 확장이 없는 것처럼 행동). `dualSubsOff` 플래그로 감지해 A3/A4/B1-B4/E-font-multiplier를 건너뛴다.
- 겹침·화면 밖 이탈은 눈이 아니라 `getBoundingClientRect()`로 수치 판정한다.
- 검사 로직은 `scripts/smoke/page-checks.js` 한 곳에 두고, **픽스처에서 먼저 검증**한다 (`test/page-checks.test.js`). 검사 스크립트 자체가 틀리면 실물 결과를 믿을 수 없기 때문.

## 구성
| 파일 | 역할 |
|---|---|
| `scripts/smoke/page-checks.js` | `runPageChecks(document, expected?)` — 페이지 안에서 실행되는 자립형 함수. 외부 참조 없음, 페이지를 바꾸지 않음. `{ ok, mode, checks: [{id, pass, detail}] }` 반환 |
| `scripts/smoke/snippet.mjs` | 위 함수를 주입 가능한 스니펫으로 출력 (`npm run smoke:snippet -- --define` 또는 `-- '{"mode":"stacked"}'`) |
| `test/page-checks.test.js` | 검사 함수를 가짜 플레이어에서 검증 |
| `src/content.ts`의 `__DSUBS_E2E__` 분기 | dev 빌드에서만 켜지는 `window.postMessage` 브리지 — 팝업 없이 설정 변경 (아래 참고) |

### 검사 ID ↔ 체크리스트
| ID | 체크리스트 | 판정 |
|---|---|---|
| A1 | A 재생 시작 | `.watch-video` 안에 `.player-timedtext` |
| A2 | A | `.my-timedtext-container`가 정확히 1개 |
| A3 | — | 자막 있을 때 미러 `translate`가 `yes`/`no` 중 하나로 명시적으로 설정됨 (off면 skip) |
| A4 | A-2 원본 미번역 | 원본 컨테이너 `translate="no"` (off면 skip) |
| B0, B1 | B-1 | 원본 텍스트 = 미러 텍스트 (또는 번역기/로컬 번역 활성 시 다를 수 있음) |
| B2, B3 | B-3 두 줄 겹침 | 스택: `mirror.top ≥ original.bottom`, 좌우: `mirror.left ≥ original.right` |
| B4 | B-4 긴 자막 | 미러 박스가 `.watch-video` 안에 있음 |
| E * | E 설정 | `expected`로 넘긴 색·투명도·배율·on/off·모드·`translator`와 계산된 스타일 비교 |
| H1, H2 | H | 옛 버튼/패널 없음 |
| S | — | 스타일 스냅샷 (판정 없음, 보고용) |

자동화 밖에 남는 것: E-11 브라우저 재시작 후 설정 유지, G Edge, 화면의 시각 품질(스크린샷 첨부로 보완).

## E2E 테스트 브리지 (설정을 완전 자동화)
자동화 도구(`javascript_tool`)는 페이지의 **main world**에서 실행되고, `chrome.storage`는 확장 컨텍스트(content script의 **isolated world**, 팝업, 백그라운드)에서만 접근 가능하다 — 직접 호출 불가(`chrome.storage` → `undefined`로 확인됨). `chrome-extension://` 페이지(팝업)도 자동화 도구가 열 수 없다. 그래서 content script(`src/content.ts`)에 **dev 빌드 전용** 브리지를 심었다:

```js
window.postMessage({ source: 'dsubs-e2e', type: 'set-preference', key, value }, '*');
```
isolated world의 리스너가 이를 받아 `savePreference(key, value)`를 호출한다 — **팝업이 호출하는 것과 완전히 같은 함수**라 진짜 설정 변경이지 우회가 아니다.

**보안 경계**: `__DSUBS_E2E__`는 `scripts/build.mjs`가 esbuild `define`으로 주입하는 상수다. `npm run build`(프로덕션)는 `false`, `npm run build:dev`는 `true`. 프로덕션 빌드에서는 `if (__DSUBS_E2E__) { ... }` 블록이 리터럴 `if (false)`가 되어 **런타임에 절대 실행되지 않는다** — 코드가 파일에서 물리적으로 제거되진 않지만(민석화 안 함), 리스너 자체가 등록되지 않으므로 프로덕션에서는 아무 페이지 스크립트도 이 경로로 설정을 바꿀 수 없다. 리스너는 `event.source === window`도 검사한다(실브라우저에서 유효한 same-window 검증; jsdom 테스트에서는 이 프로퍼티가 버그가 있어 `MessageEvent`를 직접 dispatch해서 우회 — `test/characterization.test.js`의 `postFromPage` 참고).

**사용 절차**:
1. `npm run build:dev` (한 번). `dist/manifest.json`의 이름에 `(dev)`가 붙는다
2. **사용자가** `chrome://extensions`에서 확장을 새로고침 (자동화 도구는 `chrome://` 페이지를 열 수 없어 이 한 단계만 사람이 함)
3. Netflix 탭에서 `npm run smoke:snippet -- --define` 출력을 주입한 뒤, 다음 헬퍼도 함께 주입:
   ```js
   window.__dsubsSet = (key, value) => window.postMessage({ source: 'dsubs-e2e', type: 'set-preference', key, value }, '*');
   ```
4. `window.__dsubsSet('text_color', '#FF0000')` 처럼 설정 변경 → `window.__dsubsCheck(document, {...})`로 검증. 지연 없이 즉시 반영되므로 `await new Promise(r=>setTimeout(r,500))` 정도의 짧은 대기면 충분
5. **끝나면 반드시 `npm run build`(프로덕션)로 재빌드하고 확장을 다시 새로고침** — dev 빌드를 일상 사용에 남겨두지 않는다 (소스맵 포함으로 번들이 3~4배 크고, 무엇보다 테스트 전용 브리지가 활성 상태이기 때문)

## 1단계 — Claude가 Chrome을 직접 조작 (현재 방식)
**실행: Claude Code에서 `/netflix-smoke`** — 절차 전체가 프로젝트 스킬 `.claude/skills/netflix-smoke/SKILL.md`에 있어 새 세션이나 다른 모델에서도 같은 순서·같은 스니펫으로 재현된다. 스니펫은 저장소 코드에서 매번 생성하므로 스킬과 검사 로직이 어긋나지 않는다. 아래는 스킬의 요약.

전제: Netflix에 로그인된 Chrome, `dist/`가 언팩 로드됨(설정까지 자동화하려면 `build:dev`), 자막이 켜진 타이틀 URL.

기준 타이틀 (대사가 이어지는 구간으로 바로 진입해 자막을 빨리 얻는다):
- 에피소드 1 `https://www.netflix.com/watch/80014298?t=1320` — 22:00부터 식사 장면
- 에피소드 2 `https://www.netflix.com/watch/80014299?t=510` — 8:30부터 식사 장면 (가장 빠른 시작점). 에피소드 1 끝에서 자동재생하면 여기로 넘어옴 (C-1)

절차 (도구: claude-in-chrome MCP):
1. 새 탭 → 타이틀 `/watch/<id>` URL로 이동. 재생 시작 후 원본 자막 텍스트가 나타날 때까지 폴링 (`.player-timedtext` innerText)
2. `read_console_messages(onlyErrors)` — 확장 관련 에러 수집 (A-3)
3. `runPageChecks(document, { mode: 'stacked' })` + `window.__dsubsSet` 헬퍼 주입 → A/B/H 판정
4. 자막 몇 개를 넘기며 3을 2~3회 반복 (자막 clear 시 미러도 비는지 확인)
5. E: `window.__dsubsSet(key, value)`로 설정 변경 → `runPageChecks(document, { mirrorColor: 'rgb(...)', fontMultiplier: 1.5, ... })`로 즉시 검증. 사람 개입 없음 (dev 빌드 필요, 위 "E2E 테스트 브리지" 참고)
6. C-1 자동재생: `netflix.appContext.state.playerApp.getAPI().videoPlayer`로 끝 6초 전으로 seek → 다음 화 버튼 클릭 → URL 변경 대기
7. F: `resize_window`로 창 크기 변경 (B3/B4가 리사이즈 후에도 통과하는지)
8. 로컬 번역 모드(서버가 떠 있을 때): `window.__dsubsSet('translator', 'local')` + `sourceLang`/`targetLang`/`localServerUrl` 설정 → 자막 전환을 관찰하며 원문이 잠깐 보였다가 실제 서버 응답(번역문)으로 바뀌는지, `translate="no"`가 유지되는지 확인
9. 결과를 체크리스트 형식으로 보고. 실패 항목은 `detail`을 첨부
10. **정리**: 로컬 모드를 썼다면 `translator`를 `browser`로 되돌리고, 재생을 멈추고(`player.pause()`) 탭을 `https://www.netflix.com/browse`로 되돌린 뒤 작업용 탭을 닫는다. dev 빌드를 썼다면 `npm run build`로 프로덕션 재빌드 + 확장 새로고침

알려진 제약:
- Netflix 페이지에서 스크린샷 도구가 자주 타임아웃한다. 판정은 JS로 하므로 스크린샷은 보조 수단으로만
- `chrome://extensions` 새로고침은 자동화 도구가 할 수 없다 — dev/prod 빌드를 바꿀 때마다 사람이 한 번 클릭해야 함
- Netflix 페이지가 드물게 이상 상태(`<video>` 없음, 콘솔 로그 전무, 엉뚱한 DOM 조각만 보임)에 빠질 수 있었다 — 탭을 새로 열거나 새로고침하면 해소됨. 재시도 2~3회로 안 풀리면 사용자에게 화면을 확인해 달라고 요청한다 (자동화 도구 쪽 문제인지 실제 페이지 문제인지 구분이 안 될 때가 있음)

## 2단계 — Playwright 로컬 E2E (보류)
`docs/REFACTORING_PLAN.md` Phase 7 참고. E2E 테스트 브리지 덕분에 1단계(Claude 조작)만으로 설정까지 완전 자동화됐으므로 우선순위가 낮아짐. 그래도 "사람 개입 0, 터미널 한 줄" 조건을 원하면 진행: 1단계 절차를 `test/e2e/netflix.spec.js`로 옮기고 `runPageChecks`를 `page.evaluate`로, 설정은 같은 `postMessage` 브리지를 `page.evaluate`로 호출. 전용 Chrome 프로필 + `--load-extension=dist`(dev 빌드), CI 제외.
