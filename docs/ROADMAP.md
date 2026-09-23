# 로드맵

리팩토링(Phase 0~6, `REFACTORING_PLAN.md`)은 2026-09-16에 끝났다. 이후 방향.

## 완료: 로컬 NLLB 번역 (코딩 완료, E2E 대기)
브라우저 내장 번역기 대신 **CTranslate2에 올린 `nllb-200-distilled-600M`**으로 확장이 직접 번역하도록 구현했다. 상세 설계·구현 기록·사용법은 **`docs/NLLB_TRANSLATION.md`**(작업 일지 겸 사용법 문서).

- 서버(`server/`, FastAPI): `POST /translate`, `GET /health`. 유닛 테스트 25/25 + 실모델 통합 테스트 17개
- 확장(TS): `preferences.ts`에 `translator`/`sourceLang`/`targetLang`/`localServerUrl` 추가, `background.ts`가 로컬 서버로 fetch, `subtitles.ts`가 자막을 번역해 미러에 반영(원문 즉시 표시 → 번역 도착 시 교체, stale 응답 방지), 팝업에 엔진 전환 UI. 유닛 테스트 68/68
- **미완료 항목은 실물 E2E뿐** — 사용자 입회 시 진행. 체크리스트는 `docs/NLLB_TRANSLATION.md`의 "확인 필요"

동기(왜 이 방향인지)는 `docs/NLLB_TRANSLATION.md`에 옮겼다.

## 다음 후보 (미착수)
- Phase 7 2단계 Playwright E2E — Claude 스킬(`/netflix-smoke`)로 충분하다고 판단 (2026-09-16). 필요해지면 `REFACTORING_PLAN.md` Phase 7 계획대로
- Edge 지원 — `IS_EDGE` 분기는 검증 수단 없이 보존 중. 로컬 번역 E2E가 끝나면 Edge 번역기 우회 코드 상당수가 불필요해질 수 있음(로컬 모드에서는 브라우저 번역기 자체를 안 씀) — 재검토 대상
- Netflix 클래스명 변경 대응 — `netflix-selectors.ts`의 안정적 이름만 사용. 깨지면 그 파일부터
- 다국어 자막(2줄 이상) 번역 품질 — 현재는 병합된 텍스트를 통째로 한 번에 번역 요청. 품질 문제가 보이면 줄 단위 분리 재검토 (`docs/NLLB_TRANSLATION.md` 참고)
