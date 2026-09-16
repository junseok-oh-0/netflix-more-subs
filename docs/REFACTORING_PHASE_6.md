# Phase 6 — CI · TypeScript

상태: **완료** · 2026-09-16

## CI (`8a70f1c`)
`.github/workflows/ci.yml` — push/PR마다 `lint → typecheck → format:check → test → build`, `dist/`를 아티팩트로 업로드. 첫 푸시는 PAT에 `workflow` 스코프가 없어 거부됐고, 스코프 부여 후 성공.

## TypeScript 전환
결정 3("Phase 3 이후로 연기")에 따라 모듈 경계가 잡힌 뒤 진행.

| 항목 | 내용 |
|---|---|
| 소스 | `src/*.js` → `src/*.ts` (git mv, 히스토리 유지). 9개 파일 |
| 설정 | `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `noEmit` (트랜스파일은 esbuild가 담당), `types: ["chrome"]` |
| 도구 | `typescript` 6, `@types/chrome`, `typescript-eslint` (recommended). `npm run typecheck` 추가, CI에 포함 |
| 테스트 | JS 그대로 유지 (`test/*.test.js`). 헬퍼·테스트가 `.ts` 엔트리/모듈을 import — vitest·esbuild가 처리 |
| 빌드 | `scripts/build.mjs` 엔트리를 `.ts`로. 출력 파일명은 그대로 `dist/*.js` |

### 타입으로 드러난 것 / 고친 것
- `Preferences` 인터페이스와 `PreferenceKey`가 팝업·content·세션 전체의 계약이 됨. `normalizeValue<K>`가 키별 반환 타입을 보장
- 팝업 컨트롤: `checked`(boolean)와 `value`(string)를 한 속성으로 뭉개 쓰던 것을 분기로 명시
- `style['-webkit-transform']` 인덱스 접근 → `setProperty`/`removeProperty`
- `firstChild`/`children`에 대한 `HTMLElement` 가드 (`instanceof`) — 텍스트 노드 접근이 컴파일 타임에 걸러짐
- `overflowsParent`: `parentElement` null 가드 추가
- `sideBySideLeftPx`의 `parseInt(number)` → `Math.trunc` (동일 결과, 타입 정직)
- `try/catch`로 감싸던 "자막 없음" 케이스 4곳이 null 체크로 대체됨

## 검증
```
npm run typecheck → 0 errors
npm run lint      → 0
npm test          → 43 passed
npm run build     → content 14.7kb, popup 4.3kb
```

## 수동 스모크
동작 변화를 의도하지 않은 순수 타입 작업이지만 번들이 바뀌었으므로 `docs/SMOKE_CHECKLIST.md` A·B·E 를 한 번 확인.
