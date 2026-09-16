# Netflix More Subs

Netflix 위에 두 번째 자막 줄을 얹어 주는 Chrome 확장. 원본 자막은 그대로 두고(`translate="no"`), 그 아래에 번역 가능한 복제본(`translate="yes"`)을 만들어 브라우저 번역기가 그 줄만 번역하게 한다. 그래서 원문과 번역을 동시에 볼 수 있다.

**상태: v0.1.0, 미완성, 개인 사이드 프로젝트.** [DeeFrancois/netflix-dual-subs](https://github.com/DeeFrancois/netflix-dual-subs) v1.9를 포크해 전면 리팩토링한 것이며, 스토어에 올라간 원작과는 별개로 개발한다. 원작의 아이디어와 코드에 감사한다 (GPL-3.0).

## 지금 되는 것
- 재생 시작·에피소드 자동재생·타이틀 전환 시 두 번째 자막 줄 표시 (스택 / 좌우 배치)
- 확장 아이콘 팝업에서 크기·색·투명도·on/off·배치 모드 설정. 설정은 `chrome.storage.sync`에 저장되고 즉시 반영
- 브라우저 번역기(우클릭 → "번역")를 켜면 두 번째 줄만 번역됨

## 앞으로 할 것
브라우저 번역기 의존을 없애고 **CTranslate2 위의 `nllb-200-distilled-600M`** 로컬 번역 서버를 붙여 확장이 직접 번역한다. 계획은 [docs/ROADMAP.md](docs/ROADMAP.md).

## 설치 (개발용)
```
npm install
npm run build          # src/ → dist/
```
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `dist/`. 확장을 다시 로드한 뒤에는 **열려 있던 Netflix 탭도 새로고침**해야 한다 (옛 content script가 남는다).

## 사용
1. Netflix에서 배우려는 언어의 자막을 켠다
2. (선택) 우클릭 → "…로 번역" 으로 브라우저 번역기를 켜면 아래 줄이 번역된다
3. 확장 아이콘 팝업에서 모양을 조절한다

## 개발
```
npm test               # vitest: 단위 + content script를 가짜 Netflix 플레이어에서 실행
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run build:dev      # localhost 매치가 추가된 dist/ (픽스처 페이지용)
npm run fixture        # test/fixtures/fake-player.html → http://localhost:8787/
```
- 소스는 TypeScript, `src/`. `dist/`는 생성물
- 문서: [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md)(계획·결정·결함 이력), `docs/REFACTORING_PHASE_N.md`(단계별 기록), [docs/SMOKE_CHECKLIST.md](docs/SMOKE_CHECKLIST.md)(실물 확인 항목), [docs/SMOKE_AUTOMATION.md](docs/SMOKE_AUTOMATION.md)
- 실물 스모크: Claude Code에서 `/netflix-smoke`
- 작업 규칙: [CLAUDE.md](CLAUDE.md)

## 라이선스
[GPL-3.0](LICENSE). 원작 © DeeFrancois, 변경분 © Junseok Oh.
