# Netflix More Subs

Netflix 위에 두 번째 자막 줄을 얹어 주는 Chrome 확장. 원본 자막은 그대로 두고(`translate="no"`), 그 아래에 번역된 복제본을 보여준다. 번역은 두 가지 방식 중 고를 수 있다: 브라우저 내장 번역기, 또는 로컬에서 도는 NLLB 번역 서버.

**상태: v0.1.0, 미완성, 개인 사이드 프로젝트.** [DeeFrancois/netflix-dual-subs](https://github.com/DeeFrancois/netflix-dual-subs) v1.9를 포크해 전면 리팩토링한 것이며, 스토어에 올라간 원작과는 별개로 개발한다. 원작의 아이디어와 코드에 감사한다 (GPL-3.0).

## 지금 되는 것
- 재생 시작·에피소드 자동재생·타이틀 전환 시 두 번째 자막 줄 표시 (스택 / 좌우 배치), 가독성을 위한 테두리 스타일
- 확장 아이콘 팝업에서 원본/번역 자막 각각의 크기·색·투명도, on/off, 배치 모드 설정. 설정은 `chrome.storage.sync`에 저장되고 즉시 반영
- 번역 엔진 두 가지:
  - **브라우저 번역기** (기본값) — 우클릭 → "번역"을 켜면 두 번째 줄만 번역됨
  - **로컬 서버** — CTranslate2 위의 `nllb-200-distilled-600M`으로 확장이 직접 번역. 브라우저 번역기 없이도 동작하고, 언어 쌍을 직접 고를 수 있다. 실행 방법은 아래 "번역 서버"

## 설치 (개발용)
```
npm install
npm run build          # src/ → dist/
```
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `dist/`. 확장을 다시 로드한 뒤에는 **열려 있던 Netflix 탭도 새로고침**해야 한다 (옛 content script가 남는다).

## 사용
1. Netflix에서 배우려는 언어의 자막을 켠다
2. 확장 아이콘 팝업에서 번역 엔진을 고른다
   - Browser Translator: 우클릭 → "…로 번역"으로 브라우저 번역기를 켠다
   - Local Server (NLLB): 아래 "번역 서버"를 먼저 띄운 뒤, 팝업에서 Source/Target Language와 서버 주소(기본 `http://127.0.0.1:8008`)를 지정한다
3. 팝업에서 원본/번역 자막 크기·색·투명도·배치 모양을 각각 조절한다

## 번역 서버 (로컬 NLLB)
Python + FastAPI + CTranslate2로 만든 로컬 번역 서버. `server/`에 있다. 상세 사용법·환경변수·API 계약·설계 배경은 **[docs/NLLB_TRANSLATION.md](docs/NLLB_TRANSLATION.md)**에 전부 있다 — 여기는 요약만.

의존성: `fastapi`, `uvicorn`, `ctranslate2`, `transformers`, `sentencepiece` (`server/requirements.txt`), CTranslate2로 변환한 NLLB 모델(기본 경로 또는 `NLLB_MODEL_DIR` 환경변수로 지정).

실행:
```
cd server
python -m uvicorn app:app --host 127.0.0.1 --port 8008
```
확인: `curl http://127.0.0.1:8008/health` → `{"status":"ok","model_loaded":true,...}`

서버 테스트:
```
cd server
python -m pytest                   # 빠른 테스트만 (모델 미로드)
RUN_MODEL_TESTS=1 python -m pytest  # 실제 모델 로드까지 포함
```

## 개발
```
npm test               # vitest: 단위 + content script를 가짜 Netflix 플레이어에서 실행
npm run lint            # eslint
npm run typecheck       # tsc --noEmit
npm run build:dev       # 소스맵 + localhost 매치가 추가된 dist/ (픽스처 페이지, E2E 테스트 브리지용)
npm run fixture         # test/fixtures/fake-player.html → http://localhost:8787/
```
- 소스는 TypeScript, `src/`. `dist/`는 생성물. 번역 서버는 Python, `server/`
- 문서: [docs/ROADMAP.md](docs/ROADMAP.md)(현재 상태·다음 계획), [docs/NLLB_TRANSLATION.md](docs/NLLB_TRANSLATION.md)(번역 서버+통합 작업 일지 겸 사용법), [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md)(리팩토링 계획·결정·결함 이력), [docs/SMOKE_CHECKLIST.md](docs/SMOKE_CHECKLIST.md)(실물 확인 항목), [docs/SMOKE_AUTOMATION.md](docs/SMOKE_AUTOMATION.md)(자동화 방식)
- 실물 스모크: Claude Code에서 `/netflix-smoke` — 설정 변경까지 완전 자동(`npm run build:dev` 필요)
- 작업 규칙: [CLAUDE.md](CLAUDE.md)

## 라이선스
[GPL-3.0](LICENSE). 원작 © DeeFrancois, 변경분 © Junseok Oh.
