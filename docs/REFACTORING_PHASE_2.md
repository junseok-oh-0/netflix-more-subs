# Phase 2 — 설정 파이프라인 단일화 + 설정 UI 일원화

상태: **완료 (스모크 대기)** · 2026-09-15
원칙: 설정의 진실 원천은 `chrome.storage.sync` 하나. 자막 렌더링·레이아웃·옵저버 로직은 건드리지 않음.

## 커밋

| 커밋 | 내용 |
|---|---|
| `c034c5e` | 2026-09-15 스모크 결과 기록, 결함 SM-1~5를 계획서 §5에 배치 |
| `ad5bca6` | 확장 소스를 `src/`로 이동. 테스트 호스트가 esbuild로 메모리 번들 후 eval (import 지원) |
| `f7ef130` | `src/preferences.js` 추가 + 단위 테스트 12개 |
| `742f139` | `popup.js`를 preferences 모듈 기반으로 재작성 + 팝업 테스트 3개 |
| `ad5d742` | `content.js`가 storage를 직접 읽고 `onChanged`에 반응. `background.js` 202줄 → 5줄 |
| `82912c7` | `settings_box.html`·인페이지 패널 코드·플레이바 버튼·`weird_classname_mode` 삭제 |

## 결정 사항 확정
- **결정 1 (설정 UI)**: `popup.html` 유지, `settings_box.html` 삭제. 플레이바 버튼은 **제거** (사용자 결정 2026-09-15). 설정은 확장 아이콘 팝업으로만 한다.

## 설계 결과

### 흐름
```
popup.js ──savePreference()──▶ chrome.storage.sync ──onChanged──▶ content.js applyPreferenceChange(key, value)
                                       ▲
content.js ──loadPreferences()─────────┘  (시작 시 1회, 결측/이형 값은 normalize)
```
- 메시지 타입 9종, `background.js`의 인메모리 캐시·중계·`tabs.query` 라우팅 전부 삭제
- `background.js`는 `onInstalled(install) → tutorial.html` 만 남음

### `src/preferences.js`
- `DEFAULT_PREFERENCES` 단일 정의 (기존엔 content/background 2곳)
- `normalizeValue/normalizePreferences`: 결측→기본값, 옛 저장 형식 흡수(`0/1`→boolean, 숫자 문자열→number), 범위·색상 형식 검증, 미지의 키 제거 → **기존 사용자 storage 마이그레이션 불필요**
- `savePreference(key, value)` / `savePreferences(partial)` / `onPreferencesChanged(cb)` — `areaName !== 'sync'` 무시
- `button_on_off`는 UI가 없는 사장 항목이라 제거

### 자연 해소된 버그
| 버그 | 해소 이유 |
|---|---|
| SW 재시작 시 `0`/`false` 값이 기본값으로 리셋 (`background.js` truthy 검사) | 캐시 자체가 사라짐. normalize는 `typeof`/`Number.isFinite`로 판단 |
| `request_preferences` 응답 레이스 | content가 storage를 직접 읽음 |
| 활성 탭에만 전달 → 비활성 Netflix 탭 미반영 | `onChanged`는 모든 탭에 전달됨 |
| 팝업 열 때마다 `open_settings_menu` 메시지 전송 | 삭제 |
| `on_off`가 `1`/`true` 혼재, `font_multiplier` 문자열 전달 | normalize에서 타입 강제 |

## 코드 규모
| 파일 | Phase 1 후 | Phase 2 후 |
|---|---|---|
| `content.js` | 1,068 | 637 |
| `background.js` | 202 | 5 |
| `popup.js` | 168 | 62 |
| `preferences.js` | — | 66 |
| `settings_box.html` | 412 | 삭제 |

## 검증
```
npm run lint   → 0
npm test       → 30 passed, 2 todo (SM-1, SM-2)
npm run build  → content 22.9kb, popup 3.7kb; dist/에 settings_box.html 없음, manifest에 web_accessible_resources 없음
```
테스트 구성: 특성화 11 · 픽스처 계약 4 · preferences 12 · popup 3

## 수동 스모크 (필요)
`docs/SMOKE_CHECKLIST.md` 갱신본으로 A, B(1~2), E, H 확인. 특히:
- 팝업에서 값 변경 → Netflix 탭에 즉시 반영 (Netflix 탭이 활성 탭이 아닐 때도)
- Stacked OFF 후 **브라우저 완전 재시작** → OFF 유지 (SW 리셋 버그 해소)
- 플레이바에 버튼이 없고, 콘솔에 에러가 없음

## 다음 단계
Phase 3 — content.js 모듈 분리 + SM-1(자동재생) 해결. `docs/REFACTORING_PLAN.md` 참고.
