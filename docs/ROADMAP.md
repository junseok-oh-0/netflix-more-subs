# 로드맵

리팩토링(Phase 0~6, `REFACTORING_PLAN.md`)은 2026-09-16에 끝났다. 이후 방향.

## 다음: 브라우저 번역기 대체 — 로컬 NLLB 번역
브라우저 내장 번역기 대신 **CTranslate2에 올린 `nllb-200-distilled-600M`**으로 확장이 직접 번역한다.

동기
- 번역기 UI(우클릭 메뉴)에 의존하지 않는다. 사용자가 켜고 끄는 단계가 사라진다
- 언어 쌍·품질을 우리가 통제한다. 원작이 "지원 안 됨"으로 적어 둔 언어(한국어·일본어 등 하드코딩 자막 계열)도 원문만 있으면 된다
- 번역 결과를 자막 줄에 직접 쓰므로 `<font>` 래핑 같은 번역기 흔적을 다룰 필요가 없다

큰 그림 (미확정, 개발하며 조정)
1. **로컬 번역 서버**: CTranslate2 + `nllb-200-distilled-600M`, HTTP 엔드포인트 `POST /translate {text, src, tgt}`. 별도 저장소 또는 `server/`
2. **확장 쪽**: `subtitles.ts`의 미러링 지점(`s.container.innerText = text`)에서 텍스트를 서버로 보내고 응답을 미러에 쓴다. 지연을 감추기 위해 자막 텍스트 단위 캐시, 요청 중엔 원문 표시
3. **설정**: 팝업에 서버 주소·원본/목표 언어(NLLB 코드, 예 `eng_Latn` → `kor_Hang`)·"브라우저 번역기 사용 / 로컬 서버 사용" 전환 추가. `preferences.ts`의 `Preferences`에 키 추가 → normalize → 팝업 컨트롤 순서로
4. **권한**: `manifest.json` `host_permissions`에 로컬 서버 주소. content script에서 직접 fetch하면 Netflix CSP에 막힐 수 있으므로 background(서비스 워커)를 경유
5. **검증**: 픽스처의 번역기 흉내(`fakeTranslate`)를 서버 흉내로 바꾸고, `page-checks.js`의 B1을 "미러 = 서버 응답"으로 확장. `translate="yes"` 플래그는 유지하되 브라우저 번역기와 이중 번역되지 않도록 로컬 모드에선 `translate="no"`

리팩토링에서 이미 준비된 것
- 미러링·배치·설정이 모듈로 분리돼 번역 삽입 지점이 한 곳(`subtitles.ts` addSubs)
- `Preferences` 타입이 계약이라 설정 추가가 컴파일 타임에 강제됨
- 픽스처·특성화 테스트·`/netflix-smoke`로 회귀를 잡을 수 있음

## 보류
- Phase 7 2단계 Playwright E2E — Claude 스킬로 충분하다고 판단 (2026-09-16). 필요해지면 `REFACTORING_PLAN.md` Phase 7 계획대로
- Edge 지원 — `IS_EDGE` 분기는 검증 수단 없이 보존 중. 로컬 번역으로 가면 Edge 번역기 우회 코드 대부분이 불필요해짐
- Netflix 클래스명 변경 대응 — `netflix-selectors.ts`의 안정적 이름만 사용. 깨지면 그 파일부터
