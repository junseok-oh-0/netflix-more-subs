# 리팩토링 계획

대상: Dual Subtitles for Netflix v1.9 (DeeFrancois/netflix-dual-subs 포크)
작성일: 2026-09-12

## 0. 확정된 결정 사항

| # | 결정 | 내용 |
|---|---|---|
| 1 | 설정 UI 일원화 | **`popup.html`(확장 프로그램 기본 액션 팝업)을 남기고 `settings_box.html`(인페이지 패널)을 삭제**한다. 설정 로직은 한 벌만 존재해야 한다. **플레이바 버튼은 제거** (2026-09-15 확정, Phase 2에서 적용). |
| 2 | 번들러 도입 | **esbuild** 도입. `src/` → `dist/` 빌드, `dist/`를 언팩 확장으로 로드한다. |
| 3 | TypeScript | Phase 3(모듈 분리) 완료 이후로 미룬다. 정리 작업과 타입 작업을 섞지 않는다. |

## 1. 현황 진단 요약

### 구조적 문제
- `content.js` 1,302줄 단일 파일에 플레이어 감지·버튼·설정 패널·자막 렌더링·레이아웃 계산·메시지 처리가 혼재
- `window.*` 전역 상태 25개 이상, 함수 간 암묵적 의존
- 설정 UI가 `popup.html`과 `settings_box.html` 두 벌
- 설정 항목별 메시지 타입 9종. background는 "저장 + 활성 탭 전달"을 9회 복붙, content는 핸들러 9개 복붙
- `background.js`의 인메모리 `preferences` 캐시는 MV3 서비스 워커 종료 시 소실 → 재시작 직후 레이스
- `chrome.tabs.query({active:true})` 기반 라우팅 → Netflix가 비활성 탭이면 오전송. `sender.tab.id`를 써야 함
- Netflix 클래스명 리터럴 10여 개가 코드 곳곳에 산재
- jQuery 실사용 4곳뿐인데 content·popup 양쪽에서 로드

### 중복
- `injected-style` 생성 3회 (`content.js:673, 1117, 1269`, 세 번째는 `className` 누락으로 제거 불가)
- `sub_bot` 계산 4회, `original_subs_placement`/`sub_dist` 계산 4회
- 오버플로 폰트 축소 `while` 루프 4회
- 우클릭 활성화 `getElementsByTagName("*")` 전체 순회 2회 (리스너 누수)
- 버튼 SVG 2벌, 탭 전환 코드 3회, `default_preferences` 2곳

### 버그 / 사체 코드
| 위치 | 문제 |
|---|---|
| `content.js:993` | `actual_create_buttons;` 호출 아님 (no-op) |
| `content.js:937` | `my_timedtext_element = original_subs` — 요소 참조를 문자열로 덮어씀 |
| `content.js:810-812` | `.left`/`.transform`을 `.style` 없이 대입 (no-op) |
| `content.js:228` | `if(parseInt(a), parseInt(b))` 쉼표 연산자 (Phase 1 스모크 수정에서 코드 삭제) |
| `content.js:211-239` | 비디오 전환 감지가 해시 클래스명(`ltr-*`)에 의존 → 현재 Netflix에서 동작 안 함 (Phase 1 스모크 수정으로 해소) |
| `content.js:625` | `if(HTMLCollection)` 항상 truthy |
| `background.js:72-138` | truthy 검사로 `0`/`false` 값을 결측으로 오인 → 기본값 리셋. `button_up_down_mode=false`가 SW 재시작 후 되돌아감 |
| 타입 혼재 | `on_off`가 `1` ↔ `true/false`, `font_multiplier` 문자열 전달 |
| `content.js:738` | `old_inset` 미갱신 |
| 옵저버 누수 | `observer`, `translation_tracker`, `button_observer`가 `disconnect()` 없이 재생성 |
| `manifest.json:39` | `web_accessible_resources.matches: ["<all_urls>"]` |
| `update.html` | 불필요하게 `popup.js` 로드 |
| 주석 사체 | 약 200줄 |

### 테스트 장애물
1. 모듈 시스템 없음
2. 모든 함수가 `document`/`window.*`/`chrome.*`에 직접 결합
3. 순수 계산과 DOM 조작이 한 함수에 혼재
4. 실제 Netflix는 DRM·로그인으로 E2E 자동화 불가
5. 브라우저 내장 번역기 동작을 재현할 장치 없음

## 2. 방향성

**기능 동결, 동작 보존, 작은 단계, 단계마다 실제 Netflix 수동 스모크.**

1. 안전망 먼저 (도구, 픽스처, 체크리스트)
2. 순수 로직과 DOM 어댑터 분리
3. 설정 파이프라인 단일화 (`chrome.storage.onChanged` 하나로)
4. Netflix 의존성 격리 (셀렉터 모듈 1개)
5. 옵저버 생명주기 명시화 (`PlayerSession.dispose()`)
6. TypeScript·CI는 이후 선택

## 3. 단계별 계획

진행 상황은 각 Phase별 `docs/REFACTORING_PHASE_N.md`에 기록한다.

### Phase 0 — 안전망 구축 (코드 변경 없음)
- `git tag v1.9-baseline`
- `package.json` + esbuild + vitest/jsdom + eslint/prettier
- `dist/` 빌드 파이프라인 (현재 파일 그대로 번들·복사, 언팩 로드 가능 상태)
- 가짜 Netflix 플레이어 픽스처 페이지 (`test/fixtures/fake-player.html`)
  - `.player-timedtext` 1-컨테이너 / 2-컨테이너
  - 일반 / `Css` 클래스명 모드
  - 자막 갱신 타이머, 번역기 흉내(`<font>` 래핑)
- 픽스처 계약 테스트 (content.js가 의존하는 셀렉터가 픽스처에 존재하는지)
- 특성화 테스트: jsdom에서 실제 `content.js`를 실행해 v1.9 동작을 고정 (Phase 1~3의 회귀 감지용)
- 수동 스모크 체크리스트 (`docs/SMOKE_CHECKLIST.md`)
- 진행 기록: `docs/REFACTORING_PHASE_0.md`

### Phase 1 — 기계적 정리 (동작 변화 0)
- 주석 사체 삭제, 미사용 함수/변수 제거 (`open_browser_action`, `counter`, `first_run`, `cleared`)
- `var` → `const/let`, 오타 수정
- jQuery 제거
- `manifest.json` `web_accessible_resources` 범위 축소, `update.html`에서 `popup.js` 제거
- 명백한 no-op 삭제 (`:993`, `:810-812`)

### Phase 2 — 설정 파이프라인 단일화
- `src/preferences.js`: `DEFAULT_PREFERENCES` 단일 정의, `normalize()` (타입 강제, 결측 기본값) — 단위 테스트
- background: 설치 시 기본값 저장만. 캐시·중계 삭제
- content: 시작 시 `storage.sync.get`, 이후 `storage.onChanged`. 메시지 핸들러 9개 삭제
- **결정 1 적용**: `settings_box.html` 및 `applyPreferencesToSettingsMenu`/`draggable`/`closeable` 삭제. `popup.js`가 유일한 설정 UI. 플레이바 버튼 제거
- 완료: `docs/REFACTORING_PHASE_2.md`
- falsy 리셋 버그 자연 해소

### Phase 3 — content.js 모듈 분리
**셀렉터 원칙 (Phase 1 스모크에서 확인)**: 해시 클래스명(`ltr-*`)은 Netflix 배포마다 바뀌므로 쓰지 않는다. `watch-video`, `watch-video--player-view`, `player-timedtext`, `player-timedtext-text-container`, `aria-label` 같은 안정적인 이름만 `netflix-selectors.js`에 둔다. (`weird_classname_mode`와 플레이바 버튼은 Phase 2에서 이미 삭제됨.)
```
src/
  content.js            # 진입점: 세션 생성/파괴
  netflix-selectors.js  # 안정적인 클래스명·셀렉터만
  dom.js                # waitForElement, injectStyle(id)/removeStyle(id)
  player-watcher.js     # 비디오 전환 감지 (SM-1 해결 지점)
  layout.js             # 순수: computeBottom(), computeLeft(), fitFontSize()
  subtitles.js          # 컨테이너 생성, mergeContainers(), addSubs, 옵저버 소유
  preferences.js        # Phase 2 산출물
```
- `window.*` → 세션 상태 객체 하나
- 4회 중복 계산 → `layout.js` 함수 1개씩
- **SM-1 (자동재생)**: `player-watcher.js`는 (a) `.watch-video--player-view` 재마운트 외에 (b) `.player-timedtext` 노드가 교체되는 경우도 비디오 전환으로 취급한다. 픽스처에 `nextEpisode()`(플레이어 뷰 유지, timedtext만 교체 + URL 변경)를 추가해 테스트로 고정
- **SM-3 (긴 자막 축소)**: `fitFontSize()`를 순수 함수로 빼면서 단위 테스트 (스모크에서 검증 안 된 항목)

완료: `docs/REFACTORING_PHASE_3.md`. 요소 참조 덮어쓰기·`.style` 없는 대입·`injected-style` 누적 버그는 모듈 분리 중 자연 해소.

### Phase 4 + 5 — 남은 버그 · 성능 (한 커밋)
완료: `docs/REFACTORING_PHASE_4.md`
- SM-6 (`.watch-video` 밖 캡션 노드로 세션 생성 시 null) 수정
- 우클릭 활성화 → `window` capture 리스너 1개
- SM-2는 Phase 3 이후 재현되지 않아 수정 없이 종료. `s.oldInset`·`watchPlayer` 범위는 의도적으로 유지 (사유는 Phase 4 문서)

### Phase 6 — 선택
- JSDoc → TypeScript
- GitHub Actions: lint + vitest (+ Playwright 픽스처 E2E)

## 4. 리스크
Netflix 실제 DOM에서만 확인되는 동작이 있어 자동 테스트만으로 안전을 보장할 수 없다. 단계를 잘게 나누고 매 단계 수동 스모크를 수행한다.

## 5. 스모크에서 발견된 결함 → 작업 배치

2026-09-15 스모크(Phase 1 + `d5a7d2d`) 결과. 표기 규칙은 `SMOKE_CHECKLIST.md` 참고.

| ID | 항목 | 증상 | 추정 원인 | 배치 |
|---|---|---|---|---|
| SM-1 | C-1 자동재생 | 다음 에피소드로 넘어가면 번역 자막이 안 나옴. 플레이바 버튼은 유지, 콘솔 에러 없음, on/off 토글해도 안 나옴. 뒤로가기→다른 타이틀은 정상 | 자동재생 시 Netflix가 `.watch-video--player-view`를 재마운트하지 않고 내부의 `.player-timedtext`만 교체하는 것으로 보임. 버튼이 남아 있는 것이 그 증거. `window.observer`는 떨어져 나간 옛 `.player-timedtext`를 계속 감시하므로 자막 이벤트를 못 받는다. (`d5a7d2d`에서 삭제한 옛 세 번째 조건이 이 케이스용이었으나 해시 DOM에 의존해 어차피 동작 안 함) | **해소 (Phase 3)** — `player-watcher.js`가 `.player-timedtext` 출현을 기준으로 감지, 세션 `dispose()`로 옛 옵저버 정리. 테스트로 고정 |
| SM-2 | B-3 두 줄 자막 | 원문 아랫줄과 번역 윗줄이 겹침 | 번역 컨테이너 `bottom`이 `sub_bot − baseFont×mult − 10`으로 원본이 1줄이라고 가정. 원본이 2줄이면 그만큼 아래로 더 내려야 함 | **해소** — Phase 3 이후 스모크에서 재현 안 됨 (2026-09-16). 재발 시 `layout.js` `stackedTranslatedBottomPx`를 실측 박스 기준으로 |
| SM-3 | B-4 긴 자막 축소 | 검증 안 됨 (재현할 긴 자막이 없었음) | — | **해소 (Phase 3)** — `layout.js` `fitFontSize()` 단위 테스트 3개 |
| SM-4 | D-2 버튼 hover | 강조는 되나 Netflix 버튼과 다름 (정상 판정) | hover 시 해시 클래스(`ltr-1enhvti`)를 붙이는데 현재 Netflix에 존재하지 않는 클래스 | **해소** — Phase 2에서 버튼 자체를 제거 (`82912c7`) |
| SM-5 | G Edge | 미실행 | — | 리스크로 유지. `IS_EDGE` 분기는 검증 수단이 없으므로 리팩토링 시 로직을 바꾸지 않고 옮기기만 한다 |
| SM-6 | A-3 콘솔 에러 (2026-09-16 발견) | `Cannot read properties of null (reading 'insertAdjacentHTML')` 1회 | `.watch-video` 밖(브라우즈 미리보기)에서 `.player-timedtext`가 나타나면 세션이 `document.querySelector('.watch-video')`로 null을 받음 | **해소 (Phase 4)** — `closest('.watch-video')` 없으면 세션 생성 안 함 |

A-4(콘솔 XHR 에러)와 D-1(컨트롤 바는 x로만 닫힘)은 확장과 무관하거나 정상 동작으로 판정, 조치 없음.
