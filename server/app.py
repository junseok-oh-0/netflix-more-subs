"""FastAPI app exposing the local NLLB translator over HTTP.

Local dev tool only: CORS is wide open and it binds to 127.0.0.1 by default. Never expose this
to a public interface.

Run: `python -m uvicorn app:app --host 127.0.0.1 --port 8008` (from this directory, venv active).
"""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import Settings, load_settings
from translator import LANG_CODE_RE, NllbTranslator, TranslationError


class TranslateRequest(BaseModel):
    texts: list[str] = Field(min_length=1)
    source_lang: str
    target_lang: str


class TranslateResponse(BaseModel):
    translations: list[str]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    compute_type: str


def create_app(settings: Optional[Settings] = None, translator: Optional[NllbTranslator] = None) -> FastAPI:
    """Factory so tests can inject a fake translator instead of loading the real 600M model."""
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if app.state.translator is None:
            app.state.translator = NllbTranslator(settings)
            app.state.translator.warmup()
        yield

    app = FastAPI(title="NLLB Translation Server", lifespan=lifespan)
    app.state.settings = settings
    app.state.translator = translator

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            model_loaded=app.state.translator is not None,
            device=settings.device,
            compute_type=settings.compute_type,
        )

    @app.post("/translate", response_model=TranslateResponse)
    def translate(req: TranslateRequest) -> TranslateResponse:
        translator: Optional[NllbTranslator] = app.state.translator
        if translator is None:
            raise HTTPException(status_code=503, detail="model not loaded yet")

        if len(req.texts) > settings.max_batch:
            raise HTTPException(status_code=422, detail=f"too many texts (max {settings.max_batch})")
        for text in req.texts:
            if len(text) > settings.max_text_len:
                raise HTTPException(
                    status_code=422, detail=f"text too long (max {settings.max_text_len} chars)"
                )
        if not LANG_CODE_RE.match(req.source_lang) or not LANG_CODE_RE.match(req.target_lang):
            raise HTTPException(status_code=422, detail="language codes must look like 'eng_Latn'")

        try:
            translations = translator.translate_batch(req.texts, req.source_lang, req.target_lang)
        except TranslationError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        except Exception as e:  # CTranslate2/tokenizer runtime failures
            raise HTTPException(status_code=500, detail=f"translation failed: {e}") from e

        return TranslateResponse(translations=translations)

    return app


# `uvicorn app:app` entry point. Real model load is deferred to the lifespan startup hook above,
# so importing this module (e.g. for tests via create_app()) never touches the 600M model.
app = create_app()
