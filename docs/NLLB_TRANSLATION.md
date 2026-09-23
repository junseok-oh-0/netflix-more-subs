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
- [ ] 로드맵 재검토·갱신 (Part 1에서 배운 것 반영)
- [ ] Part 2: TS 쪽 통합 (preferences → background → subtitles → popup)
- [ ] 유닛 테스트 추가 (TS 쪽)
- [ ] 사용자 E2E (보류 — 사용자 입회 시 진행)

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
(구현하며 아래를 채운다)

### 새 모듈
- `src/translation/types.ts` — 메시지 프로토콜 타입 (content ↔ background)
- `src/translation/local-client.ts` — content 쪽: `translateLocal(texts, prefs)`, 캐시, background로 메시지 전송
- `background.ts` — 메시지 리스너: 로컬 서버로 실제 fetch

### Preferences 추가 키
```ts
translator: 'browser' | 'local'   // 기본 'browser'
sourceLang: string                // 기본 'eng_Latn'
targetLang: string                // 기본 'kor_Hang'
localServerUrl: string            // 기본 'http://127.0.0.1:8008'
```

### manifest.json
`host_permissions`에 `http://127.0.0.1/*`, `http://localhost/*` 추가 (Chrome 매치 패턴은 포트를 명시하지 않으며 모든 포트에 매치됨 — MDN/Chrome 문서 기준. **E2E에서 실제 확인 필요**, 아래 "확인 필요" 참고).

## 확인 필요 (E2E에서 사용자가 검증)
- [ ] `host_permissions`의 포트 없는 패턴이 실제로 임의 포트(8008)에 매치되는지
- [ ] background 서비스 워커에서 로컬 서버로 fetch가 CSP/네트워크 정책에 막히지 않는지
- [ ] 번역 지연(첫 요청 워밍업 포함)이 자막 흐름에서 체감되는 수준인지
- [ ] 로컬 모드에서 브라우저 번역기가 동시에 켜져 있어도 이중 번역이 안 되는지 (미러 `translate="no"`로 방지했다고 가정)

## 다음에 볼 것
- `docs/ROADMAP.md` — 이 작업이 끝나면 갱신
- `CLAUDE.md` — 서버 개발 유의사항 섹션
