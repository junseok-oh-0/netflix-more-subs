# 스모크 자동화 (Phase 7)

`docs/SMOKE_CHECKLIST.md`의 수동 항목을 실제 Netflix에서 자동으로 확인한다.

## 원칙
- **브라우저 번역기는 검증 대상이 아니다.** 번역은 브라우저 몫이므로 두 컨테이너에 같은 원문이 떠도 된다. 확장이 책임지는 것은 (1) 원본 컨테이너 `translate="no"`, (2) 번역 컨테이너 `translate="yes"`, (3) 미러링·배치. 이 덕분에 "항상 번역" 설정 같은 전제가 없다. 번역기가 켜져 있으면 미러에 `<font>`가 생기므로 검사는 그 경우도 통과시킨다.
- 겹침·화면 밖 이탈은 눈이 아니라 `getBoundingClientRect()`로 수치 판정한다.
- 검사 로직은 `scripts/smoke/page-checks.js` 한 곳에 두고, **픽스처에서 먼저 검증**한다 (`test/page-checks.test.js`). 검사 스크립트 자체가 틀리면 실물 결과를 믿을 수 없기 때문.

## 구성
| 파일 | 역할 |
|---|---|
| `scripts/smoke/page-checks.js` | `runPageChecks(document, expected?)` — 페이지 안에서 실행되는 자립형 함수. 외부 참조 없음, 페이지를 바꾸지 않음. `{ ok, mode, checks: [{id, pass, detail}] }` 반환 |
| `scripts/smoke/snippet.mjs` | 위 함수를 붙여넣기/주입 가능한 한 줄 스니펫으로 출력 (`npm run smoke:snippet -- '{"mode":"stacked"}'`) |
| `test/page-checks.test.js` | 검사 함수를 가짜 플레이어에서 검증 (정상 통과 / 겹침·플래그 누락·버튼 잔존 감지 / 자막 없음) |

### 검사 ID ↔ 체크리스트
| ID | 체크리스트 | 판정 |
|---|---|---|
| A1 | A 재생 시작 | `.watch-video` 안에 `.player-timedtext` |
| A2, A3 | A | `.my-timedtext-container`가 정확히 1개, `translate="yes"` |
| A4 | A-2 원본 미번역 | 원본 컨테이너 `translate="no"` |
| B0, B1 | B-1 | 원본 텍스트 = 미러 텍스트 (또는 번역기 활성 시 `<font>` 존재) |
| B2, B3 | B-3 두 줄 겹침 | 스택: `mirror.top ≥ original.bottom`, 좌우: `mirror.left ≥ original.right` |
| B4 | B-4 긴 자막 | 미러 박스가 `.watch-video` 안에 있음 |
| E * | E 설정 | `expected`로 넘긴 색·투명도·배율·on/off·모드와 계산된 스타일 비교 |
| H1, H2 | H | 옛 버튼/패널 없음 |
| S | — | 스타일 스냅샷 (판정 없음, 보고용) |

자동화 밖에 남는 것: C-2 뒤로가기 후 다른 타이틀(수동 또는 navigate로 가능), E-11 브라우저 재시작, G Edge, 화면의 시각 품질(스크린샷 첨부로 보완).

## 1단계 — Claude가 Chrome을 직접 조작 (현재 방식)
**실행: Claude Code에서 `/netflix-smoke`** — 절차 전체가 프로젝트 스킬 `.claude/skills/netflix-smoke/SKILL.md`에 있어 새 세션이나 다른 모델에서도 같은 순서·같은 스니펫으로 재현된다. 스니펫은 `npm run smoke:snippet -- --define`으로 저장소 코드에서 매번 생성하므로 스킬과 검사 로직이 어긋나지 않는다. 아래는 스킬의 요약.
전제: Netflix에 로그인된 Chrome, `dist/`가 언팩 로드됨, 자막이 켜진 타이틀 URL 1개, 확장 ID(`chrome://extensions`에 표시).

기준 타이틀 (대사가 이어지는 구간으로 바로 진입해 자막을 빨리 얻는다):
- 에피소드 1 `https://www.netflix.com/watch/80014298?t=1320` — 22:00부터 식사 장면
- 에피소드 2 `https://www.netflix.com/watch/80014299?t=510` — 8:30부터 식사 장면 (가장 빠른 시작점). 에피소드 1 끝에서 자동재생하면 여기로 넘어옴 (C-1)

절차 (도구: claude-in-chrome MCP):
1. 새 탭 → 타이틀 `/watch/<id>` URL로 이동. 재생 시작 후 원본 자막 텍스트가 나타날 때까지 폴링 (`.player-timedtext` innerText)
2. `read_console_messages(onlyErrors)` — 확장 관련 에러 수집 (A-3)
3. `runPageChecks(document, { mode: 'stacked' })` 주입 → A/B/H 판정
4. 자막 몇 개를 넘기며 3을 2~3회 반복 (B-2 잔상: 자막 clear 시 미러도 비는지 — `B0` 실패 + 미러 텍스트 `''`로 확인)
5. E: `chrome-extension://<ID>/popup.html`을 새 탭으로 열어 컨트롤 값을 바꾸고(`dispatchEvent(new Event('change'))`) Netflix 탭에서 `runPageChecks(document, { mirrorColor: 'rgb(...)', fontMultiplier: 1.5, ... })`로 반영 확인. 끝나면 Reset
6. C-1 자동재생: `netflix.appContext.state.playerApp.getAPI().videoPlayer`로 끝 5초 전으로 seek → URL의 `/watch/<id>`가 바뀔 때까지 대기 → 3 반복
7. F: `resize_window`로 창 크기 변경 → 3 반복 (B3/B4가 리사이즈 후에도 통과하는지)
8. 결과를 체크리스트 형식으로 보고. 실패 항목은 `detail`을 첨부
9. **정리**: 플레이어 API로 재생을 멈추고(`player.pause()`) 탭을 `https://www.netflix.com/browse`로 되돌린 뒤 작업용 탭을 닫는다. 사용자의 시청 화면을 재생 중인 상태로 남기지 않는다

알려진 제약: Netflix 페이지에서 스크린샷 도구가 자주 타임아웃한다(페이지가 무거움). 판정은 JS로 하므로 스크린샷은 보조 수단으로만.

## 2단계 — Playwright 로컬 E2E (계획)
`docs/REFACTORING_PLAN.md` Phase 7 참고. 1단계 절차를 `test/e2e/netflix.spec.js`로 옮기고 `runPageChecks`를 `page.evaluate`로 호출한다. 전용 Chrome 프로필 + `--load-extension=dist`, CI 제외.
