# CLAUDE.md — 작업 지침

Netflix 위에 두 번째 자막 줄을 얹는 Chrome 확장(MV3, TypeScript, esbuild). 개인 사이드 프로젝트, v0.1.x, 미완성. 대화는 한국어로.

## 먼저 읽을 것
1. `docs/ROADMAP.md` — 지금 어디에 있고 다음이 무엇인지
2. `docs/REFACTORING_PLAN.md` — 확정된 결정(§0), 단계별 계획, 스모크에서 발견된 결함과 처리(§5)
3. 최신 `docs/REFACTORING_PHASE_N.md` — 직전 작업의 상세와 "의도한 동작 변화"
4. `docs/SMOKE_CHECKLIST.md` 맨 위 "마지막 실행" 줄

## 명령
```
npm test            # vitest — 반드시 통과
npm run lint        # eslint — 0건
npm run typecheck   # tsc --noEmit — 0건
npm run build       # src/ → dist/ (언팩 로드 대상)
npm run format      # prettier
```
커밋 전 네 가지 모두 실행한다. CI(GitHub Actions)도 같은 순서로 돈다.

## 구조 (src/)
- `content.ts` 진입점: prefs 로드/구독 + `watchPlayer` → `.player-timedtext`마다 세션 1개
- `subtitles.ts` 세션: 옵저버·addSubs·배치·스타일·`dispose()`. **자막 로직은 전부 여기**
- `layout.ts` 순수 계산 (DOM 없음, 단위 테스트 대상) · `dom.ts` DOM 헬퍼 · `player-watcher.ts` 전환 감지
- `preferences.ts` `Preferences` 인터페이스 = 팝업·content·세션의 계약. 설정은 `chrome.storage.sync`가 유일한 진실
- `netflix-selectors.ts` 안정적 클래스명만
- `popup.ts` 유일한 설정 UI. `background.ts`는 설치 시 튜토리얼만

## 지켜야 할 것
- **해시 클래스명(`ltr-*`) 금지.** Netflix 배포마다 바뀐다. `watch-video`, `player-timedtext`, `player-timedtext-text-container`, `aria-label`만. 새 셀렉터는 `netflix-selectors.ts`에
- **원본 자막 DOM 깊이를 가정하지 않는다.** `container > div > span`이 항상은 아니다. `styledTextElements`/`readBaseFont`처럼 `[style*="font-size"]`로 찾고 `instanceof HTMLElement`로 가드
- **줄 수를 가정하지 않는다.** 배치는 실측 박스(`getBoundingClientRect`) 기준 (`placeContainer`). "한 줄 높이 = 폰트 크기"식 계산은 SM-2 겹침을 다시 부른다
- **설정 흐름은 storage 한 갈래.** 메시지 중계·인메모리 캐시·`tabs.query` 라우팅을 다시 만들지 않는다. 새 설정은 `Preferences` 타입 → `normalizeValue` → 팝업 컨트롤 → `applyPreferenceChange` 순서로 추가
- **세션은 `dispose()`로 정리.** 옵저버·컨테이너·스타일을 남기지 않는다. 주입 스타일은 `injectStyle(id)`로 멱등
- **브라우저 번역기는 검증 대상이 아니다.** 확장의 책임은 `translate="no"`(원본)/`"yes"`(미러) 플래그, 미러링, 배치. 두 줄에 같은 원문이 떠도 정상
- Edge 분기(`IS_EDGE`)는 검증 수단이 없다. 옮기기만 하고 로직을 바꾸지 않는다

## 작업 방식
- 큰 작업은 Phase로 나누고 `docs/REFACTORING_PHASE_N.md`에 기록: 변경 내용, **의도한 동작 변화 표**, 남은 버그, 검증 결과, 스모크 결과. 계획서 §5 스타일로 결함에 ID(SM-n)를 붙인다
- 버그는 **재현 테스트를 먼저** 써서 실패를 본 뒤 고친다. jsdom엔 레이아웃이 없으므로 위치 검사는 `getBoundingClientRect`를 흉내 낸다 (`test/characterization.test.js` `fakeRects`)
- 자동 테스트만으로는 부족하다. 사용자 눈에 보이는 변경 뒤에는 실물 스모크: Claude Code에서 **`/netflix-smoke`** (스킬이 절차·스니펫·정리를 안다). 사용자가 수동으로 할 때는 `docs/SMOKE_CHECKLIST.md`에 `[y]`/`[n]`/`[?]`로 표시하고 `n`/`?`엔 ` -> 코멘트`
- 확장 재로드 뒤 **Netflix 탭 새로고침**을 잊으면 옛 content script의 에러가 보인다. "설정이 안 바뀐다", "삭제한 기능이 보인다"는 먼저 이걸 의심
- **커밋은 적게, 단계 단위로.** 한 Phase = 커밋 1~2개. 테스트·lint·typecheck·build 통과 후 커밋하고, 사용자가 스모크 통과를 확인하면 푸시 (요청 시 바로 푸시). 커밋 메시지는 왜를 쓴다
- 사용자 결정이 필요한 것(기능 삭제, UI 변경, 의존성 추가 등)은 옵션과 권장안을 제시하고 기다린다. 결정은 `REFACTORING_PLAN.md` §0에 기록
- 원작 코드에 있던 이상한 로직은 "왜 있었는지"를 먼저 추정해 문서에 남기고 바꾼다. 검증 수단이 없으면 유지하고 사유를 적는다 (`oldInset` 사례)

## 번역 서버 (server/)
Python/FastAPI. TS 쪽과 도구가 다르므로 별도 규칙.

- venv는 `~/.venv_global` (프로젝트 전용 venv 만들지 않는다). `fastapi`, `uvicorn`, `ctranslate2`, `transformers`, `sentencepiece`, `pytest`, `httpx` 설치돼 있음
- 모델은 저장소 밖 `~/libs/models/nllb-200-distilled-600M-int8-ct2` (커밋 금지, `.gitignore`와 무관하게 애초에 저장소 밖)
- 테스트는 반드시 `server/`에서 실행 (`server/pyproject.toml`의 `pythonpath`가 상대 import를 해결). `cd server && ~/.venv_global/bin/python -m pytest`
- **기본 테스트는 모델을 로드하지 않는다.** `create_app(translator=FakeTranslator())`처럼 항상 주입. 실제 모델 테스트는 `RUN_MODEL_TESTS=1`로만 (수 초 걸림)
- `TestClient(app)`을 `with` 없이 쓰면 FastAPI `lifespan`이 실행되지 않는다 (Starlette 1.6.0 실측). "모델 로드 전" 상태를 테스트할 때 이용하고, 실수로 무거운 lifespan을 트리거하지 않도록 주의
- CT2 `Translator`는 `intra_threads`로 이미 내부 병렬화하므로, 요청을 동시에 여러 개 처리하게 만들지 않는다 (락으로 직렬화). "더 빠르게 하려고" 락을 풀지 말 것
- 언어 코드(FLORES-200, `eng_Latn` 형식)는 정규식으로 형식만 먼저 걸러내고, 실제 존재 여부는 토크나이저 어휘 조회로 확인한다. 200개를 하드코딩하지 않는다
- 서버는 로컬 전용(127.0.0.1), CORS 전부 허용 — 인터넷에 노출하는 변경을 하지 않는다
- 서버를 띄워 테스트한 뒤에는 **반드시 프로세스를 죽인다** (`pkill -f "uvicorn app:app"` 또는 PID). 켜둔 채 세션을 넘기지 않는다

## 로컬 번역(NLLB) — 통합 패턴
상세는 `docs/NLLB_TRANSLATION.md`(작업 일지 겸 사용법). 여기는 재사용할 패턴만.

- `subtitles.ts`의 `createSubtitleSession(...)`은 `translate` 함수를 4번째 인자로 주입받는다(기본값은 실제 구현). 테스트는 `chrome.runtime.sendMessage`까지 안 가고 `host.chrome.setSendMessageHandler(...)`로 응답을 직접 제어한다 (`test/helpers/extension-host.js`)
- **비동기 자막 갱신은 반드시 staleness 가드가 있어야 한다.** 자막은 빠르게 바뀌므로, 늦게 도착한 응답이 그새 바뀐 화면을 덮어쓰면 안 된다. `translationSeq` 카운터 패턴(요청 시점의 값을 캡처, 응답 시점에 비교) 참고. 새로 비동기 자막 갱신을 추가할 때 이 패턴을 복사한다
- 오토 리졸브(즉시 resolve하는) mock으로는 "응답 대기 중" 상태를 테스트할 수 없다 — `await tick()` 한 번에 마이크로태스크가 이미 다 풀린다. `deferred()`(resolve를 밖에서 쥐는 Promise) 패턴을 쓴다 (`test/characterization.test.js`)
- content→background 메시지 핸들러를 `window.eval`로 번들 실행하는 테스트에서, mock 에러 객체는 **그 window의 생성자**로 만든다 (`new bg.window.TypeError(...)`, `new TypeError(...)` 아님). `instanceof` 체크가 realm을 타기 때문 — 한 번 이걸로 테스트가 깨졌었다

## E2E 테스트 브리지 — dev 전용 코드를 안전하게 넣는 법
`chrome-extension://` 페이지(팝업)는 자동화 도구가 열 수 없고, 자동화 JS는 페이지 main world에서 돌아 `chrome.storage`(content script isolated world 전용)에 못 닿는다. 그래서 `content.ts`에 `window.postMessage` 브리지를 심어 팝업과 똑같이 `savePreference()`를 호출하게 했다 (`/netflix-smoke` 스킬, `docs/SMOKE_AUTOMATION.md`). 이 패턴을 다른 곳에도 적용할 때:
- 게이트는 **esbuild `define`으로 주입하는 리터럴 boolean** (`__DSUBS_E2E__`, `scripts/build.mjs`)으로 한다. 프로덕션 빌드에선 `if (false)`가 되어 리스너 자체가 등록되지 않는다 — `NODE_ENV` 문자열 비교 같은 런타임 분기보다 확실하다
- TS에서는 `declare const __DSUBS_E2E__: boolean;`으로 앰비언트 선언만 하고, 실제 값은 빌드 시점에 치환된다
- 테스트 번들(`test/helpers/extension-host.js`의 `bundleEntry`)도 같은 `define`을 넘겨야 한다 — 안 그러면 `ReferenceError`로 기존 테스트가 전부 깨진다
- 메시지 핸들러는 `event.source === window`로 스푸핑을 막는다. **jsdom의 진짜 `window.postMessage()`는 이 프로퍼티를 제대로 안 채운다**(버그) — 테스트에서는 `window.dispatchEvent(new MessageEvent('message', { data, origin, source: window }))`로 직접 디스패치해서 우회한다. `postMessage()` 자체를 테스트하지 말고, 리스너의 반응을 테스트한다
- 이런 브리지를 쓴 뒤에는 **반드시 프로덕션으로 재빌드**하고 확장을 다시 로드한다. dev 빌드를 일상 사용에 남기지 않는다

## 함정 메모
- `.player-timedtext`는 브라우즈 페이지 미리보기에도 나타난다 → `closest('.watch-video')` 없으면 세션 만들지 않음 (SM-6)
- 자동재생은 플레이어 뷰를 유지하고 캡션 노드만 교체한다 → 감지는 캡션 노드 출현 기준 (SM-1)
- `<br>`을 숨기는 CSS는 현재 Netflix DOM에서 효과가 없다. 원본이 두 줄이면 두 줄로 렌더된다
- `chrome-extension://` 페이지는 claude-in-chrome 도구로 열 수 없다 — 팝업 UI 자체를 조작할 순 없지만, 위 E2E 브리지로 설정 변경은 자동화 가능
- Netflix 페이지가 드물게 `<video>`도 콘솔 로그도 없는 이상 상태에 빠진다. 탭을 새로 열거나 새로고침하면 보통 풀린다. 2~3회 재시도해도 안 풀리면 자동화 도구 쪽 문제와 실제 페이지 문제를 구분하기 어려우니 사용자에게 화면을 봐 달라고 요청한다
