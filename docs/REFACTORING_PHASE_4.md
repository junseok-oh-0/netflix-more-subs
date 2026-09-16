# Phase 4 + 5 — 남은 버그 수정 · 성능

상태: **완료 (스모크 대기)** · 2026-09-16
Phase 3에서 대부분의 버그가 자연 해소돼 남은 항목이 적어 두 Phase를 한 커밋으로 묶었다.

## 수정

### SM-6 — `.watch-video` 밖의 캡션 노드 (A-3 에러)
- 증상: `Cannot read properties of null (reading 'insertAdjacentHTML')`
- 원인: `createSubtitleSession`이 `document.querySelector('.watch-video')`로 컨테이너를 찾음. 브라우즈 페이지 미리보기처럼 `.watch-video` 밖에서 `.player-timedtext`가 나타나면 null
- 수정: `content.js`가 `timedtext.closest('.watch-video')`로 조상을 찾고 없으면 세션을 만들지 않음. 세션은 그 조상을 인자로 받음 (`createSubtitleSession(timedtext, watchVideo, prefs)`)
- 테스트: "ignores caption nodes that are not inside a .watch-video player"

### SM-2 — 두 줄 원본 위에 번역이 겹침 (B-3)
- 원인: 번역 컨테이너를 `bottom = 원본 bottom − baseFont×mult − 10`으로 배치. 원본과 번역이 각각 한 줄일 때만 맞는 식이라, 두 줄이면 번역 컨테이너 높이가 두 배가 되어 위쪽 줄이 원본 아랫줄을 덮음. (원작자가 `<br>`을 숨기는 CSS로 한 줄을 강제하려 했으나 현재 Netflix DOM에선 효과가 없음)
- 수정: 줄 수를 가정하지 않는다. 스택 모드는 원본 컨테이너의 **실측 박스 아래에 `top`으로** 붙이고(`topBelow`, 간격 8px — 우리 높이와 무관), 좌우 모드는 원본의 실측 bottom 가장자리에 정렬(`bottomAlignedTo`). `layout.js`의 `originalBottomPx`/`stackedTranslatedBottomPx`(inset 파싱, `'.' + "5%"` 오파싱 포함)는 삭제
- 배치 코드 4곳(addSubs, onResize, 스택 진입/해제)을 `placeContainer(orig)` 하나로 통합. 리사이즈 시 스택 모드도 재배치됨 (이전엔 no-op)
- 테스트: `getBoundingClientRect`를 흉내 내어 스택/좌우 모드의 `top`/`bottom` 값을 단언 (특성화 2개) + `layout.test.js` 2개

### Phase 5 — 우클릭 활성화
- 이전: 세션 시작마다 `getElementsByTagName('*')` 전체를 돌며 요소마다 capture 리스너 추가 + `oncontextmenu = null`. 세션이 바뀔 때마다 누적, 새로 생긴 요소는 미적용
- 이후: `window`에 capture 리스너 1개 (`stopPropagation`). 캡처 단계 최상단에서 끊으므로 Netflix의 어떤 핸들러에도 도달하지 않고, 이후 생긴 요소도 자동 적용. 스크립트 로드 시 1회 호출
- 픽스처에 Netflix식 `preventDefault` 핸들러 추가, 테스트 "lets the context menu through Netflix's suppression"

## 의도적으로 유지한 것
- **`s.oldInset` 미갱신**: 첫 실제 리사이즈 이후에는 `.player-timedtext`의 style 속성 변경마다 `onResize()`가 실행된다. 낭비지만, "Netflix가 텍스트를 끊임없이 새로 그리므로 스타일을 계속 재적용해야 한다"는 원작자 주석이 이 경로에 기대고 있을 가능성이 있어 실물 검증 없이 바꾸지 않는다. 실제 리사이즈 동작(F)은 스모크에서 통과 중
- **`watchPlayer` 감시 범위 (`documentElement` 전체)**: 노드 추가마다 `matches`/`querySelector` 1회. 비용이 작고 범위를 좁히면 플레이어 마운트 전 타이밍 문제가 생길 수 있어 유지

## 계획서 §5 최종 상태
| ID | 상태 |
|---|---|
| SM-1 자동재생 | Phase 3 해소, 스모크 `y` |
| SM-2 두 줄 겹침 | Phase 4 해소 (실측 박스 기반 배치) |
| SM-3 긴 자막 | `fitFontSize` 단위 테스트로 대체 |
| SM-4 버튼 hover | Phase 2 버튼 제거로 해소 |
| SM-5 Edge | 미검증 리스크 유지 |
| SM-6 `.watch-video` 밖 캡션 | Phase 4 해소 |

## 검증
```
npm run lint   → 0
npm test       → 43 passed
npm run build  → content 14.2kb
```

## 수동 스모크
`docs/SMOKE_CHECKLIST.md`. 특히:
- **B-3 두 줄 자막** — 번역이 원본 아래에 겹침 없이 붙어야 함 (SM-2). 한 줄 자막의 간격도 이전과 비슷한지(8px)
- A-3 콘솔 에러 없음, A-4 브라우즈 미리보기 재생 시 에러 없음 (SM-6), A-5 플레이어 위 우클릭 메뉴
- F 리사이즈 — 스택 모드에서 리사이즈 후 번역 위치가 원본을 따라가는지 (이번에 재배치 추가됨)
