# Phase 4 + 5 — 남은 버그 수정 · 성능

상태: **완료 (스모크 대기)** · 2026-09-16
Phase 3에서 대부분의 버그가 자연 해소돼 남은 항목이 적어 두 Phase를 한 커밋으로 묶었다.

## 수정

### SM-6 — `.watch-video` 밖의 캡션 노드 (A-3 에러)
- 증상: `Cannot read properties of null (reading 'insertAdjacentHTML')`
- 원인: `createSubtitleSession`이 `document.querySelector('.watch-video')`로 컨테이너를 찾음. 브라우즈 페이지 미리보기처럼 `.watch-video` 밖에서 `.player-timedtext`가 나타나면 null
- 수정: `content.js`가 `timedtext.closest('.watch-video')`로 조상을 찾고 없으면 세션을 만들지 않음. 세션은 그 조상을 인자로 받음 (`createSubtitleSession(timedtext, watchVideo, prefs)`)
- 테스트: "ignores caption nodes that are not inside a .watch-video player"

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
| SM-2 두 줄 겹침 | Phase 3 이후 재현 안 됨, 스모크 `y` |
| SM-3 긴 자막 | `fitFontSize` 단위 테스트로 대체 |
| SM-4 버튼 hover | Phase 2 버튼 제거로 해소 |
| SM-5 Edge | 미검증 리스크 유지 |
| SM-6 `.watch-video` 밖 캡션 | Phase 4 해소 |

## 검증
```
npm run lint   → 0
npm test       → 41 passed
npm run build  → content 14.6kb
```

## 수동 스모크
`docs/SMOKE_CHECKLIST.md`. 특히 A-3(콘솔 에러 없음)이 `y`로 바뀌어야 하고, **브라우즈 페이지에서 미리보기가 재생될 때**도 콘솔 에러가 없어야 한다(새 항목 A-4). 우클릭 → "번역" 메뉴가 플레이어 위에서 열리는지(A-5).
