# Phase 1 — 기계적 정리

상태: **완료** · 2026-09-12
원칙: 동작 변화 0. 삭제·이름 없는 형식 변환만. 알려진 버그는 그대로 두고 `// BUG: ... (fixed in Phase N)`으로 표시.

## 변경 내용

### content.js (1,302 → 1,068줄)
- 주석 처리된 사체 코드 전부 삭제 (옛 `getSetting` 구현, Edge 번역 차단 시도 묘지, `sub_distance`, 옛 버튼 SVG, 데브 로그)
- 미사용 제거: `open_browser_action()`, `window.player_active`, `window.counter`, `window.cleared`, `window.preferences`, `last_url`, `old_style`(암묵적 전역), `first_run` 블록(`actual_create_buttons;` no-op 포함), 두 번째 `buttonSpacing` 생성(추가된 적 없음), 빈 `if` 블록(`TRANSLATION`)
- jQuery 제거 (4곳): `$().remove()` → `querySelectorAll().forEach(remove)`, `$().append()` → `insertAdjacentHTML('beforeend')`, `$()[1].remove()` → `getElementsByClassName()[1].remove()`
- 우클릭 활성화 루프 2회 중복 → `enable_right_click()` 함수 1개 (내용 동일)
- `var` → `const`/`let`. 블록 내 `var sub_bot`/`sub_dist` 재선언 → 각 블록 `const`
- 암묵적 전역 참조를 명시: `my_timedtext_element`, `original_subs`, `original_text_side` → `window.*`
- `catch(e)` 미사용 → `catch {}`
- 리스너 시그니처 `function(request, sendRespone, sendResponse)` → `function(request)`
- `console.log` 디버그 출력 제거

### background.js (320 → 202줄)
- 주석 블록, `console.log("HEREEE…")` 등 디버그 로그 삭제
- `var preferences` → `const`
- 로직은 그대로 (truthy 리셋 버그 포함, Phase 2에서 파이프라인 교체 시 해소)

### popup.js (202 → 168줄)
- `/update.html` 경로 가드 삭제 (update.html이 더 이상 popup.js를 로드하지 않음)
- `button_onSwitch` 관련 코드 삭제 — `#button_switchValue`는 popup.html에서 주석 처리된 요소라 `getElementById`가 `null`을 반환
- `mySliderValue.innerHTML` (id 암묵 전역) → `slideValue.innerHTML`

### 기타
- `jquery-3.5.1.min.js` 삭제; `manifest.json`, `popup.html`, `update.html`, `scripts/build.mjs`, `eslint.config.mjs`, 테스트 헬퍼에서 참조 제거
- `manifest.json` `web_accessible_resources.matches`: `<all_urls>` → `https://www.netflix.com/*`
- `.prettierignore`에서 소스 파일 제외 해제, prettier 적용

## 부수적으로 고쳐진 것 (의도한 동작 변화)
`popup.js`의 `button_onSwitch.addEventListener(...)`는 `null.addEventListener`로 **매번 TypeError를 던졌고**, 그 뒤에 등록되는 "Stacked Subtitles" 토글과 "Reset Settings" 버튼 리스너가 등록되지 않았다. 사체 제거로 이 두 컨트롤이 팝업에서 동작하게 됐다. (인페이지 설정 패널은 별도 코드라 영향 없었음.)

## 표시해 둔 버그 (그대로 유지)
| 위치 | 내용 | 수정 Phase |
|---|---|---|
| `content.js` video_change_callback | `(parseInt(a), parseInt(b))` 쉼표 연산자 | 4 |
| `content.js` initialize_button_observer | `HTMLCollection` truthy 검사 | 4 |
| `content.js` 리사이즈 분기 | `.left`/`.transform`을 `.style` 없이 대입 | 4 |
| `content.js` addSubs | `my_timedtext_element = original_subs` 요소 참조 덮어쓰기 | 4 |
| `content.js` update_button_up_down_mode ON | `injected-style` className 누락 | 4 |
| `background.js` storage 초기화 | truthy 검사로 `0`/`false` 리셋 | 2 |

## 검증
```
npm run lint    → 0 errors (Phase 0 기준선 57)
npm test        → 16/16 passed
npm run build   → content 36.6kb, background 6.1kb, popup 4.8kb
```

## 수동 스모크
`docs/SMOKE_CHECKLIST.md` A~F 항목을 실제 Netflix에서 확인 필요. 특히:
- jQuery 제거 영향: A(컨테이너 생성), B(자막 clear 시 잔상), 2컨테이너 병합
- popup.html에서 Stacked 토글·Reset 버튼 동작 (부수 수정)

## 다음 단계
Phase 2 — 설정 파이프라인 단일화 (`docs/REFACTORING_PLAN.md` 참고).
