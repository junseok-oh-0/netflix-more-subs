# Phase 0 — 안전망 구축

상태: **완료** · 2026-09-12 · 커밋 `b2c6497`
원칙: 기존 소스(`content.js`, `background.js`, `popup.js`, HTML) 무변경.

## 산출물

| 항목 | 위치 | 비고 |
|---|---|---|
| 기준선 태그 | `git tag v1.9-baseline` | 리팩토링 전 상태 |
| 패키지/스크립트 | `package.json` | `build`, `build:dev`, `fixture`, `test`, `lint`, `format` |
| 번들러 | `scripts/build.mjs` (esbuild) | 루트 JS 3개 → `dist/`, 정적 파일 복사. `DEV=1`이면 manifest에 localhost 매치 추가 |
| 픽스처 서버 | `scripts/serve-fixture.mjs` | `http://localhost:8787/` |
| Lint | `eslint.config.mjs` | flat config, browser+webextensions 전역, `$` 허용 |
| 포맷 | `.prettierrc`, `.prettierignore` | 기존 소스는 Phase 1 전까지 포맷 대상에서 제외 |
| 테스트 러너 | `vitest.config.mjs` | jsdom은 헬퍼에서 직접 생성 |
| 가짜 플레이어 | `test/fixtures/fake-player.html` | 아래 참고 |
| 테스트 호스트 | `test/helpers/extension-host.js` | jsdom + `chrome.*` 스텁 + `innerText` 폴리필, 실제 `content.js`를 eval |
| 픽스처 계약 테스트 | `test/fixture-contract.test.js` | content.js가 의존하는 셀렉터가 픽스처에 존재하는지 (5개) |
| 특성화 테스트 | `test/characterization.test.js` | v1.9의 현재 동작을 고정 (11개) |
| 스모크 체크리스트 | `docs/SMOKE_CHECKLIST.md` | 실제 Netflix 수동 확인 항목 |

## 가짜 플레이어가 재현하는 것
- `#appMountPoint` 10단계 div 깊이 (content.js `waitForElement` 셀렉터)
- `.watch-video`, `.watch-video--player-view`, `.player-timedtext` (`inset` 인라인 스타일)
- 비디오 로드 시 `.watch-video--player-view`를 `.watch-video` 아래에 재마운트 (2026-09-15 변경; 처음엔 해시 클래스명 캔버스를 흉내 냈으나 실제 Netflix와 맞지 않아 교체)
- `button[aria-label="Seek Back"]` 2단계 위 버튼 행, 컨트롤 바 파괴/재생성 + class 토글
- 자막 1컨테이너 / 2컨테이너 (컨테이너는 한 노드씩 추가), `span[style=font-size]`, `bottom: 10%`
- 번역기 흉내: Chrome(`<font>` 래핑) / Edge(`_msttexthash` 속성)
- `window.fakePlayer` API로 테스트·수동 조작 모두 가능

## 검증 결과
```
npm run build   → dist/ 생성 (content 37.2kb, background 8.6kb, popup 5.0kb)
npm test        → 2 files, 16 tests passed
npm run lint    → 57 errors (기준선)
```

### Lint 기준선 (Phase 1 목표: 0)
| 파일 | 건수 |
|---|---|
| content.js | 54 |
| background.js | 2 |
| popup.js | 1 |

| 규칙 | 건수 |
|---|---|
| no-unused-vars | 35 |
| no-undef | 14 |
| no-redeclare | 6 |
| no-useless-assignment | 2 |

## 특성화 테스트가 고정한 동작 (v1.9)
1. 로드 시 `request_preferences` 메시지 전송
2. 비디오 로드 → `#myTutorialButton`이 버튼 행에 생성
3. `.watch-video` 안에 `.my-timedtext-container[translate=yes]` 생성
4. 1컨테이너 자막 → 자기 컨테이너에 동일 텍스트
5. 2컨테이너 자막 → 원본을 1컨테이너로 병합, `"a\nb"`로 미러링
6. 원본 컨테이너에 `translate=no`
7. 자막 clear → 자기 컨테이너 비움
8. `update_text_color` → 컨테이너 color
9. `update_on_off` false/true → display none/block
10. 컨트롤 바 재생성 → 버튼 재생성
11. 에피소드 전환 후에도 자막 미러링 유지, 버튼 1개 (2026-09-15 교체; 원래는 Css 클래스명 모드 감지였음)

## 알려진 한계
- jsdom은 레이아웃이 없어 `offsetWidth`/`getBoundingClientRect`가 0 → 폰트 축소·위치 계산은 검증 불가 (실행만 됨). 이 로직은 Phase 3에서 순수 함수로 분리한 뒤 단위 테스트한다.
- `innerText`는 폴리필(`textContent`)이라 `<br>` → 줄바꿈 변환은 재현하지 않는다.
- 실제 브라우저 번역기, DRM, Netflix 클래스명 변경은 스모크 체크리스트로만 확인.

## 다음 단계
Phase 1 (기계적 정리) — `docs/REFACTORING_PLAN.md` 참고. 매 커밋 후 `npm test && npm run lint` 실행.
