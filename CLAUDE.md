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

## 함정 메모
- `.player-timedtext`는 브라우즈 페이지 미리보기에도 나타난다 → `closest('.watch-video')` 없으면 세션 만들지 않음 (SM-6)
- 자동재생은 플레이어 뷰를 유지하고 캡션 노드만 교체한다 → 감지는 캡션 노드 출현 기준 (SM-1)
- `<br>`을 숨기는 CSS는 현재 Netflix DOM에서 효과가 없다. 원본이 두 줄이면 두 줄로 렌더된다
- `chrome-extension://` 페이지는 claude-in-chrome 도구로 열 수 없다. 팝업 조작은 사람 손
