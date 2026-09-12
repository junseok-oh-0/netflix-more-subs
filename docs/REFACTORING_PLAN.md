# 리팩토링 계획

대상: Dual Subtitles for Netflix v1.9 (DeeFrancois/netflix-dual-subs 포크)
작성일: 2026-09-12

## 0. 확정된 결정 사항

| # | 결정 | 내용 |
|---|---|---|
| 1 | 설정 UI 일원화 | **`popup.html`(확장 프로그램 기본 액션 팝업)을 남기고 `settings_box.html`(인페이지 패널)을 삭제**한다. 설정 로직은 한 벌만 존재해야 한다. 플레이바 버튼의 역할은 Phase 2에서 재정의한다 (후보: `chrome.action.openPopup()` 호출, 또는 on/off 토글 버튼으로 축소). |
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
| `content.js:228` | `if(parseInt(a), parseInt(b))` 쉼표 연산자 |
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
- **결정 1 적용**: `settings_box.html` 및 `applyPreferencesToSettingsMenu`/`draggable`/`closeable` 삭제. `popup.js`가 유일한 설정 UI. 플레이바 버튼 역할 재정의
- falsy 리셋 버그 자연 해소

### Phase 3 — content.js 모듈 분리
```
src/
  content.js            # 진입점: 세션 생성/파괴
  netflix-selectors.js  # 클래스명·셀렉터, 일반/Css 모드 매핑
  dom.js                # waitForElement, injectStyle(id)/removeStyle(id)
  player-watcher.js     # 비디오 전환 감지
  layout.js             # 순수: computeBottom(), computeLeft(), fitFontSize()
  subtitles.js          # 컨테이너 생성, mergeContainers(), addSubs, 옵저버 소유
  player-button.js      # 플레이바 버튼
  preferences.js        # Phase 2 산출물
```
- `window.*` → 세션 상태 객체 하나
- 4회 중복 계산 → `layout.js` 함수 1개씩

### Phase 4 — 버그 수정 (각각 별도 커밋 + 테스트)
- `:937`, `:228`, `:625`, `injected-style` 누적, `old_inset`

### Phase 5 — 옵저버 생명주기·성능
- `PlayerSession { start(), dispose() }`
- 우클릭 해제 → `document` capturing 리스너 1개
- `video_change_observer` 감시 범위 축소

### Phase 6 — 선택
- JSDoc → TypeScript
- GitHub Actions: lint + vitest (+ Playwright 픽스처 E2E)

## 4. 리스크
Netflix 실제 DOM에서만 확인되는 동작이 있어 자동 테스트만으로 안전을 보장할 수 없다. 단계를 잘게 나누고 매 단계 수동 스모크를 수행한다.
