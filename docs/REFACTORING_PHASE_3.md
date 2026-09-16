# Phase 3 — content.js 모듈 분리 + SM-1

상태: **완료** · 2026-09-15 · 스모크 2026-09-16 (아래)
원칙: 렌더링 로직은 옮기기만 하고 바꾸지 않는다. 예외는 아래 "의도한 동작 변화"에 명시.

## 구조

```
src/
  content.js            # 진입점 (27줄): prefs 로드/구독 + watchPlayer → 세션 1개 관리
  netflix-selectors.js  # 안정적인 셀렉터 3개. 해시 ltr-* 금지 원칙을 주석으로 명시
  dom.js                # injectStyle(id)/removeStyle(id), enableRightClick, readBaseFont, styledTextElements, overflowsParent
  layout.js             # 순수 함수: originalBottomPx, stackedTranslatedBottomPx, sideBySideLeftPx, fitFontSize + SINGLE_LINE_CSS
  player-watcher.js     # .player-timedtext 출현 감지 (SM-1)
  subtitles.js          # createSubtitleSession(timedtext, prefs) → { timedtext, applyPreferenceChange, dispose }
  preferences.js        # Phase 2
  popup.js / background.js
```

- `window.*` 전역 25개 → 세션 클로저의 상태 객체 `s` + 공유 `prefs` 객체 하나
- 4회 중복이던 `sub_bot`/`sub_dist`/폰트 축소 계산 → `layout.js` 함수 1개씩, 단위 테스트 6개
- `injected-style` 생성 3벌 → `injectStyle(STYLE_ID)` 멱등 호출

## SM-1 (자동재생) 해결
옛 감지는 "`.watch-video--player-view` 재마운트"만 봤다. 자동재생은 플레이어 뷰를 유지한 채 `.player-timedtext`만 교체하므로 놓쳤다.
`player-watcher.js`는 **추가된 노드가 `.player-timedtext`이거나 그것을 포함하면** 콜백을 부른다. 새 타이틀(플레이어 뷰 통째 삽입)과 자동재생(캡션 노드만 교체)을 한 조건으로 덮는다. `content.js`는 같은 노드면 무시, 다른 노드면 옛 세션 `dispose()` 후 새 세션.
- 픽스처 `nextEpisode()` 추가 (플레이어 뷰 유지, 캡션 노드 교체, URL 변경)
- 테스트 "SM-1: keeps mirroring when autoplay swaps .player-timedtext" 통과
- `#appMountPoint > div × 10` 구조 셀렉터와 `waitForElement`는 삭제. 캡션 노드 존재 자체가 "플레이어 준비됨"의 기준

## 의도한 동작 변화 (모두 개선 방향)
| 변화 | 이유 |
|---|---|
| 세션이 `dispose()`로 옵저버 2개·컨테이너·스타일을 정리 | 옛 코드는 옵저버를 끊지 않고 재생성 (Phase 5 항목 선반영) |
| `injected-style` 누적 버그 해소 | `injectStyle(id)`가 멱등. 테스트 "keeps exactly one injected style across stacked-mode toggles" |
| `my_timedtext_element = original_subs` 요소 참조 덮어쓰기 버그 삭제 | 도달하면 반드시 깨지는 분기라 옮기지 않음 |
| 리사이즈 분기의 `.left`/`.transform` no-op 대입 삭제 | 아무 효과 없던 코드 |
| `original_text_side == 1` 분기 삭제 | 항상 0으로 고정돼 있던 죽은 기능 |
| on_off ON 시 단일행 CSS는 스택 모드일 때만 주입 | 옛 코드는 좌우 모드에서도 주입해 `<br>`을 숨김. 세션 시작 조건(`stacked && on_off`)과 일치시킴 |
| 스택 토글 ON 시 원본 컨테이너 `bottom: 20%` → `22%` | addSubs가 쓰는 값과 통일 (다음 자막에서 어차피 22%로 덮임) |
| `firstChild` → `firstElementChild` | 공백 텍스트 노드에 `setAttribute` 하다 터지는 경우 방지 |
| prefs 로드 전에 세션이 시작되면 기본값으로 렌더 후 로드 값 적용 | 옛 코드는 로드 전 자막을 그리지 않았음. 실사용에선 ms 단위 차이 |

## 남은 알려진 버그 (Phase 4)
- **SM-2** 두 줄 원본 위에 번역이 겹침 — `stackedTranslatedBottomPx`가 원본 1줄 가정. `layout.js`로 빠져 있으니 실측 박스 기준으로 교체하면 됨
- `originalBottomPx`의 `'.' + bottomStyle` 파싱은 `"5%"`를 0.5로 읽음 (한 자리 % 값). SM-2와 함께 수정
- `s.oldInset` 미갱신 — 세션 시작 시 값과 다르기만 하면 리사이즈 분기가 매번 실행됨

## 검증
```
npm run lint   → 0
npm test       → 39 passed, 1 todo (SM-2)
npm run build  → content 14.6kb (Phase 2: 22.9kb)
```
테스트: 특성화 15 · 픽스처 계약 4 · preferences 12 · popup 3 · layout 6 (SM-3 대체)

## 수동 스모크 결과 (2026-09-16, `9c17a66`)
- **C-1 자동재생 `y`** — SM-1 해소 확인
- B-3 두 줄 자막 — 처음 `y`로 기록됐으나 오기(誤記). **여전히 겹침** (SM-2 유지 → Phase 4에서 수정)
- A-3 `n` — 새 에러 1건: `Cannot read properties of null (reading 'insertAdjacentHTML')`. 세션이 `document.querySelector('.watch-video')`로 컨테이너를 찾는데, `.watch-video` 밖(브라우즈 페이지 미리보기 등)에서 `.player-timedtext`가 나타나면 null → **SM-6**으로 등록, Phase 4에서 수정
- B-4 긴 자막 `?` — 여전히 실물 검증 없음 (단위 테스트로 대체)
- 나머지 전부 `y`
