# 로드맵

리팩토링(Phase 0~6, `REFACTORING_PLAN.md`)은 2026-09-16에 끝났다. 이후 방향.

## 완료: 로컬 NLLB 번역 (코딩 + E2E 전부 완료, 2026-09-24)
브라우저 내장 번역기 대신 **CTranslate2에 올린 `nllb-200-distilled-600M`**으로 확장이 직접 번역한다. 상세 설계·구현 기록·사용법·E2E 결과는 **`docs/NLLB_TRANSLATION.md`**(작업 일지 겸 사용법 문서).

- 서버(`server/`, FastAPI): `POST /translate`, `GET /health`. 유닛 테스트 25/25 + 실모델 통합 테스트 17개. 실서버 curl 스모크 확인
- 확장(TS): `preferences.ts`에 `translator`/`sourceLang`/`targetLang`/`localServerUrl` 추가, `background.ts`가 로컬 서버로 fetch, `subtitles.ts`가 자막을 번역해 미러에 반영(원문 즉시 표시 → 번역 도착 시 교체, stale 응답 방지), 팝업에 엔진 전환 UI. 유닛 테스트 73/73
- **실물 Netflix E2E 완료**: 브라우저 모드 회귀 없음, 실서버로 로컬 번역 모드까지 검증(원문→실제 번역 교체, 이중 번역 없음, 10회 이상 전환 성공)
- 부산물: `/netflix-smoke` 스킬에 설정까지 완전 자동화하는 **E2E 테스트 브리지**가 생겼다(dev 빌드 전용, 프로덕션에서는 dead code). 앞으로 사용자 개입 없이 팝업 관련 회귀도 자동 검증 가능

동기(왜 이 방향인지)는 `docs/NLLB_TRANSLATION.md`에 옮겼다.

## 다음 후보 (미착수)
- Phase 7 2단계 Playwright E2E — 로컬 스킬 E2E 브리지로 설정까지 완전 자동화됐으므로 우선순위 더 낮아짐. "터미널 한 줄, 사람 개입 0"이 필요해지면 `docs/SMOKE_AUTOMATION.md` 2단계 참고
- Edge 지원 — `IS_EDGE` 분기는 검증 수단 없이 보존 중. 로컬 모드에서는 브라우저 번역기 자체를 안 쓰므로 Edge 우회 코드 상당수가 불필요해질 수 있음 — 재검토 대상
- Netflix 클래스명 변경 대응 — `netflix-selectors.ts`의 안정적 이름만 사용. 깨지면 그 파일부터
- 다국어 자막(2줄 이상) 번역 품질 — 현재는 병합된 텍스트를 통째로 한 번에 번역 요청. 실서버 테스트에서 `(chuckles) SHH.` → `(웃음) SHH.` 처럼 부분 번역되는 사례를 봤다(NLLB 모델 품질 한계, 통합 버그 아님) — 품질 문제가 두드러지면 줄 단위 분리나 다른 모델 재검토 (`docs/NLLB_TRANSLATION.md` 참고)
