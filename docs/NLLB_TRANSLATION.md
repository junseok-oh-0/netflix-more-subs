# 로컬 NLLB 번역 — 작업 일지 겸 사용법

`docs/ROADMAP.md`의 "브라우저 번역기 대체" 작업 기록. 이 문서가 마스터 상태 파일이다 — 새 세션에서 이어갈 때는 이 문서의 "진행 상태"부터 읽는다.

## 목표
브라우저 내장 번역기(우클릭 메뉴) 대신, 로컬에서 도는 NLLB 번역 서버가 자막을 직접 번역한다.

## 아키텍처 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 서버 위치 | `server/` (이 저장소 안) | 별도 저장소보다 버전을 함께 관리하기 쉬움. 모델 바이너리는 저장소 밖(`~/libs/models/...`)이라 저장소 크기에 영향 없음 |
| 서버 프레임워크 | **FastAPI + Uvicorn** | `~/.venv_global`에 이미 설치돼 있음(0.141.1/0.52.4). 가볍고 널리 쓰이며, sync 핸들러는 Starlette가 자동으로 threadpool에서 돌려 CT2의 블로킹 호출과 잘 맞는다 |
| 모델/토크나이저 | CTranslate2 `Translator` + `transformers.AutoTokenizer` (facebook/nllb-200-distilled-600M) | `opus-nmt-ct2-test/performance.py` 그대로 재사용. 토크나이저는 이미 HF 캐시에 있어 오프라인 기동 가능 |
| 동시성 | `threading.Lock`으로 번역 호출 직렬화 | CT2가 `intra_threads`(기본 8)로 내부적으로 이미 멀티스레드. 동시 요청 2개가 겹치면 스레드 과다 경쟁(10코어 머신에서 16스레드) → 직렬화가 더 빠르고 단순 |
| CORS | 전부 허용(`*`) | 로컬 전용(127.0.0.1) 개발 도구. 절대 인터넷에 노출하지 않는다는 전제 |
| 언어 코드 | FLORES-200 형식 문자열 그대로 받음 (`eng_Latn` 등), 정규식으로만 형식 검증 | 200개 전체를 하드코딩하지 않음. 잘못된 코드는 CT2/토크나이저 단계에서 걸러지고 500으로 응답 |
| 확장 쪽 fetch 경로 | content script가 아니라 **background(서비스 워커)**가 fetch | 기존 로드맵 결정 유지: content script CSP 우회 이슈를 피함 |
| 확장 설정 추가 | `Preferences`에 `translator`('browser'\|'local'), `sourceLang`, `targetLang`, `localServerUrl` | 팝업에서 엔진 전환 가능. 기본값은 `translator: 'browser'`(기존 동작 그대로, breaking change 없음) |
| 번역 중 표시 | 원문을 먼저 미러에 쓰고, 번역 도착 시 교체 | 로드맵 그대로. 지연이 느껴지지 않게 |
| 캐시 | content script 내 `Map<string, string>` (키: `src|tgt|text`), 상한 500개 FIFO | 같은 대사가 반복되는 장면(재생/되감기)에서 재요청 방지 |
| 로컬 모드에서 미러의 `translate` 속성 | `"no"` | 브라우저 번역기와 이중 번역 방지. 브라우저 모드는 기존대로 `"yes"` 유지 |

## 진행 상태
- [x] 계획 수립, 이 문서 작성 (2026-09-24)
- [x] Part 1: 번역 서버 구현 (`server/`) — 2026-09-24, 실서버 curl 스모크까지 확인
- [x] CLAUDE.md에 서버 개발 유의사항 추가 — 2026-09-24
- [x] Part 2: TS 쪽 통합 (preferences → background → subtitles → popup) — 2026-09-24
- [x] 유닛 테스트 추가 (TS 쪽) — 2026-09-24, 68/68 통과 (서버 포함 시 전체 93/93)
- [ ] 사용자 E2E (보류 — 사용자 입회 시 진행)

**코딩 완료.** 계획대로 구현되고 유닛 테스트를 전부 통과해 이 작업을 완료로 처리한다(2026-09-24). 남은 것은 사용자가 입회하는 실물 Netflix E2E뿐 — 아래 "확인 필요" 참고.

## Part 1 — 번역 서버

### 파일
```
server/
  app.py           # FastAPI: POST /translate, GET /health
  translator.py    # NLLB 로드 + translate_batch()
  config.py        # 환경변수 기반 설정
  requirements.txt # 참고용 버전 고정 (venv는 이미 설치돼 있음)
  README.md        # 이 문서(NLLB_TRANSLATION.md)로 링크만
  tests/
    test_translator.py  # 언어 코드 검증 등 순수 로직
    test_app.py          # FastAPI TestClient, translator는 mock
```

### 사용법
사전 조건: `~/.venv_global`에 `fastapi`, `uvicorn`, `ctranslate2`, `transformers`, `sentencepiece` 설치돼 있음(이미 확인됨). 모델은 `~/libs/models/nllb-200-distilled-600M-int8-ct2`에 있어야 함(없으면 `NLLB_MODEL_DIR` 환경변수로 다른 경로 지정).

기동:
```bash
source ~/.venv_global/bin/activate
cd server
python -m uvicorn app:app --host 127.0.0.1 --port 8008
```
또는 `./server/run.sh` (아래 스크립트, venv 활성화까지 포함).

환경변수(전부 선택, 기본값은 `config.py` 참고):
| 변수 | 기본값 | 설명 |
|---|---|---|
| `NLLB_MODEL_DIR` | `~/libs/models/nllb-200-distilled-600M-int8-ct2` | CTranslate2 변환 모델 디렉터리 |
| `NLLB_TOKENIZER_ID` | `facebook/nllb-200-distilled-600M` | 토크나이저 HF ID |
| `NLLB_COMPUTE_TYPE` | `int8` | CT2 연산 정밀도 |
| `NLLB_INTRA_THREADS` | `8` | CT2 내부 스레드 수 |
| `NLLB_DEVICE` | `cpu` | `cpu` 또는 `cuda` |
| `NLLB_MAX_BATCH` | `16` | 요청당 최대 문장 수 |
| `NLLB_MAX_TEXT_LEN` | `500` | 문장당 최대 문자 수 |
| `SERVER_HOST` | `127.0.0.1` | |
| `SERVER_PORT` | `8008` | |

엔드포인트:
```
GET /health
  -> 200 {"status":"ok","model_loaded":true,"device":"cpu","compute_type":"int8"}

POST /translate
  body: {"texts":["Hello, world."],"source_lang":"eng_Latn","target_lang":"kor_Hang"}
  -> 200 {"translations":["안녕, 세상."]}
  -> 422 (pydantic 검증 실패: 빈 texts, 언어 코드 형식 오류, batch/길이 초과)
  -> 500 {"detail":"..."} (번역 런타임 오류 — 예: 존재하지 않는 언어 코드)
```

curl 예시:
```bash
curl -s http://127.0.0.1:8008/health
curl -s -X POST http://127.0.0.1:8008/translate \
  -H 'content-type: application/json' \
  -d '{"texts":["Hello, the weather is nice today."],"source_lang":"eng_Latn","target_lang":"kor_Hang"}'
```

테스트:
```bash
source ~/.venv_global/bin/activate
cd server
pytest                        # 빠른 테스트만 (translator는 mock), 25개 ~1초
RUN_MODEL_TESTS=1 pytest      # 실제 모델 로드까지 포함, 17개 ~5초 (모델 로드+워밍업 포함)
```
`server/pyproject.toml`의 `pythonpath = ["."]`로 `server/` 안에서 실행해야 `import app`/`import translator`/`import config`가 풀린다.

### 검증 결과 (2026-09-24)
- 빠른 테스트 25 passed, 2 skipped (모델 미로드 시)
- `RUN_MODEL_TESTS=1`: 17 passed — 실제 모델이 `kor_Hang` 대상 번역에서 한글을 생성하고, 없는 언어 코드는 `TranslationError`로 거부됨을 확인
- 실서버 기동 후 curl 스모크:
  - `GET /health` → `{"status":"ok","model_loaded":true,"device":"cpu","compute_type":"int8"}`
  - `POST /translate` 2문장 배치 → `["안녕하세요, 오늘 날씨가 좋네요.","이 모델을 CTranslate2로 실행하고 있습니다."]` (자연스러움)
  - 빈 `texts` → `422`
- 서버는 테스트 후 종료함 (계속 띄워두지 않음)

### 설계 메모 (구현 중 확정된 세부사항)
- 언어 코드 유효성: 정규식 형식 검사는 `app.py` 라우트에서(422), 실제로 토크나이저 어휘에 있는지는 `NllbTranslator.is_known_lang`에서(`TranslationError` → 422). 토크나이저에 `lang_code_to_id` 같은 공개 속성이 없어(transformers 5.11 `NllbTokenizer`), `convert_tokens_to_ids(code) != unk_token_id`로 판별하고 결과를 캐시
- `create_app(settings, translator)` 팩토리 패턴: `translator`를 주입하면 lifespan이 실제 모델을 로드하지 않음 → 테스트가 빠름. `uvicorn app:app`이 쓰는 모듈 레벨 `app = create_app()`은 `translator=None`이라 실제 기동 시에만 lifespan에서 로드
- `TestClient(app)`을 `with` 없이 쓰면 lifespan(startup/shutdown)이 아예 실행되지 않음(Starlette 1.6.0에서 실측 확인) — "모델 로드 전 503" 케이스를 실제 모델 로드 없이 테스트하는 데 이용
- 동시성: `translate_batch` 전체를 `threading.Lock`으로 감쌈. FastAPI 라우트는 `def`(비-async)라 Starlette가 스레드풀에서 실행 → CT2 호출이 블로킹이어도 이벤트 루프가 막히지 않음

## Part 2 — 확장(TypeScript) 통합

### 최종 설계 (구현 전 확정, 2026-09-24)

새 모듈:
- `src/translation/types.ts` — `TranslateRequestMessage`/`TranslateResponseMessage`(content↔background 메시지), `Translate` 함수 타입(`(text, sourceLang, targetLang, serverUrl) => Promise<string>`)
- `src/translation/local-client.ts` — content 쪽 `translateLocal: Translate`. 캐시(`Map`, 키 `sourceLang|targetLang|text`, 500개 FIFO) → 없으면 `chrome.runtime.sendMessage`로 background 호출 → 응답의 `translations[0]` 반환, 실패 시 throw
- `background.ts` — `chrome.runtime.onMessage`에 `type: 'nllb-translate'` 메시지 핸들러 추가. 서버로 `POST {serverUrl}/translate` (body는 서버 계약대로 `source_lang`/`target_lang` snake_case), 실패 시 `{ok:false, error}`

Preferences 추가 키 (실제 구현값):
```ts
translator: 'browser' | 'local'   // 기본 'browser' — 하위호환, 아무것도 안 바꾸면 기존 동작 그대로
sourceLang: string                // 기본 'eng_Latn', FLORES-200 정규식으로 검증
targetLang: string                // 기본 'kor_Hang'
localServerUrl: string            // 기본 'http://127.0.0.1:8008', new URL()로 http(s) 검증
```
`normalizeValue`의 문자열 분기를 키별 `STRING_VALIDATORS` 맵으로 일반화(기존엔 모든 문자열 키가 hex color 취급이었음).

`subtitles.ts` 통합 지점 — `createSubtitleSession(timedtext, watchVideo, prefs, translate: Translate = translateLocal)`:
- 자막 텍스트가 바뀌면 **먼저 원문을 미러에 쓴다** (기존 동작과 동일, 지연 은폐)
- `prefs.translator === 'local'`이면: 미러 `translate` 속성을 `"no"`로(이중 번역 방지), `translate(text, sourceLang, targetLang, localServerUrl)`를 비동기 호출, 도착하면 미러 텍스트를 교체
- **stale 응답 방지**: 세션에 `translationSeq` 카운터. 자막이 바뀌거나 지워질 때마다 증가. 번역 응답이 오면 그 사이 seq가 바뀌었는지 확인 후에만 반영
- `dispose()`된 세션에도 `disposed` 플래그로 응답 반영을 막음(이미 detach된 노드라 실질적 버그는 아니지만 일관성 유지)
- `applyPreferenceChange`에 `translator`/`sourceLang`/`targetLang`/`localServerUrl` 케이스 추가: 현재 떠 있는 자막을 즉시 재번역(모드 전환이 다음 자막까지 기다리지 않게)
- 여러 줄 자막(`\n` 포함, `mergeContainers`가 합친 결과)은 한 덩어리로 통째 번역 요청 — 줄별 분리는 v1에서 하지 않음(품질 트레이드오프, 필요해지면 재검토)

팝업: 기존 `controls` 레코드(체크박스/슬라이더/컬러, 전부 `HTMLInputElement`)는 그대로 두고 `sourceLang`/`targetLang`/`localServerUrl`은 같은 패턴의 텍스트 입력으로 추가. `translator`(select)만 별도로 다룬다 — 엔진 select는 `HTMLSelectElement`라 기존 `Control` 인터페이스(`HTMLInputElement`)에 안 맞고, 로컬 설정 영역의 `hidden` 토글도 필요해서 어차피 특수 처리가 필요함. `controls` 타입을 `Record` → `Partial<Record>`로 바꿔 `translator`를 자연스럽게 빼는 방식.

### manifest.json
`host_permissions`에 `http://127.0.0.1/*`, `http://localhost/*` 추가 (Chrome 매치 패턴은 포트를 명시하지 않으며 모든 포트에 매치됨 — MDN/Chrome 문서 기준. **E2E에서 실제 확인 필요**, 아래 "확인 필요" 참고).

### 구현 결과 (2026-09-24)
- `preferences.ts`: 문자열 타입 정규화를 키별 `STRING_VALIDATORS` 맵으로 일반화. `translator`/`sourceLang`/`targetLang`/`localServerUrl` 4개 키 추가
- `src/translation/types.ts` — 메시지 타입, `Translate` 함수 타입. `src/translation/local-client.ts` — 캐시(Map, 500개 FIFO)만 담당; stale 응답 방지는 캐시가 아니라 `subtitles.ts`의 `translationSeq`가 담당
- `background.ts`: `nllb-translate` 메시지 핸들러. 서버 응답 4xx/5xx는 `body.detail`을 그대로 에러 메시지로, 네트워크 실패는 `err.message`
- `subtitles.ts`: **컨테이너 생성 시 `translate` 속성을 더 이상 즉시 설정하지 않는다** — 첫 자막이 뜰 때 `applyTranslatedText()`가 모드에 따라 설정(`yes`/`no`). `translationSeq`로 stale 응답 방지, `disposed` 플래그로 dispose 후 응답 무시. `applyPreferenceChange`에 4개 키 추가 — 모드/언어/서버 전환 시 현재 자막을 즉시 재번역
- `popup.ts`/`popup.html`: `controls`를 `Record`→`Partial<Record>`로 바꿔 `translator`(select)를 일반 맵에서 제외하고 별도 배선(값 설정 + `localSettings` hidden 토글). `sourceLang`/`targetLang`/`localServerUrl`은 기존 텍스트 입력 패턴 그대로 추가, `<datalist>`로 흔한 언어 코드 자동완성
- `manifest.json`: `host_permissions` 추가

### 회귀 수정 (기존 동작 변화의 파급)
`translate` 속성이 즉시 설정 → 지연 설정으로 바뀌면서 두 곳이 그 가정에 기대고 있었다:
- `test/characterization.test.js`의 "creates the translated-subtitle container" — 컨테이너 생성 직후엔 `translate` 속성이 없다(`null`)는 것이 이제 맞는 동작. 자막이 뜬 뒤 `"yes"`가 되는지는 별도 테스트로 분리
- `scripts/smoke/page-checks.js`(A3, `/netflix-smoke` 스킬이 실물 검증에 씀) — "mirror는 항상 `translate=yes`"라는 고정 불변식이 더 이상 성립하지 않음(로컬 모드면 `no`가 맞다). A3를 "자막이 있을 때 mirror는 `yes` 또는 `no` 중 하나를 명시적으로 갖는다"로 완화하고, 특정 엔진을 기대하는 라이브 스모크를 위해 `expected.translator: 'browser'|'local'` 옵션 추가

### 테스트 구성 (신규/확장)
- `test/preferences.test.js` — 4개 신규 키 정규화 (+7 테스트)
- `test/translation/local-client.test.js` — 캐시, 언어쌍별 캐시 분리, 실패 시 미캐시, 에러 매핑 (6개, 신규 파일)
- `test/background.test.js` — snake_case 필드 변환, 4xx/5xx→detail, 네트워크 실패, 무관한 메시지 무시 (4개, 신규 파일). **주의**: 이 테스트는 `window.eval`로 별도 jsdom realm에서 코드를 실행하므로, mock 에러 객체도 반드시 그 `window`의 생성자로 만들어야 한다(`instanceof Error`가 realm을 탄다) — 실제로 한 번 이걸로 테스트가 깨졌었다
- `test/characterization.test.js` — `describe('local translation mode')` 4개: 즉시 원문 표시 후 교체, stale 응답 무시, 실패 시 원문 유지, 모드 전환 시 즉시 재번역. `deferred()` 헬퍼로 응답 타이밍을 직접 제어(오토 리졸브 mock은 `await tick()` 한 번에 이미 해소돼버려 "대기 중" 상태를 테스트할 수 없었음)
- `test/popup.test.js` — 기본값/저장값 렌더링, hidden 토글, 저장 (4개, 신규 `describe`)
- `test/helpers/extension-host.js` — `installChromeStub`에 `runtime.sendMessage` + `setSendMessageHandler` 추가 (기본은 reject)

최종: TS 쪽 `npm test` 68/68 (8개 파일). 서버 쪽 `pytest` 25/25(+`RUN_MODEL_TESTS=1`이면 17개 추가). lint 0, typecheck 0, prettier 통과, 빌드 정상(content 17.3kb, popup 5.7kb, background 1.3kb).

## 확인 필요 (E2E에서 사용자가 검증)
- [ ] `host_permissions`의 포트 없는 패턴이 실제로 임의 포트(8008)에 매치되는지
- [ ] background 서비스 워커에서 로컬 서버로 fetch가 CSP/네트워크 정책에 막히지 않는지
- [ ] 번역 지연(첫 요청 워밍업 포함)이 자막 흐름에서 체감되는 수준인지
- [ ] 로컬 모드에서 브라우저 번역기가 동시에 켜져 있어도 이중 번역이 안 되는지 (미러 `translate="no"`로 방지했다고 가정)

## 다음에 볼 것
- `docs/ROADMAP.md` — 이 작업이 끝나면 갱신
- `CLAUDE.md` — 서버 개발 유의사항 섹션
