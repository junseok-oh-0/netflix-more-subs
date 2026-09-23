"""Environment-driven settings. No framework dependency on purpose (importable without FastAPI)."""

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_MODEL_DIR = str(Path.home() / "libs/models/nllb-200-distilled-600M-int8-ct2")


@dataclass(frozen=True)
class Settings:
    model_dir: str
    tokenizer_id: str
    compute_type: str
    intra_threads: int
    device: str
    max_batch: int
    max_text_len: int
    host: str
    port: int


def load_settings() -> Settings:
    return Settings(
        model_dir=os.environ.get("NLLB_MODEL_DIR", DEFAULT_MODEL_DIR),
        tokenizer_id=os.environ.get("NLLB_TOKENIZER_ID", "facebook/nllb-200-distilled-600M"),
        compute_type=os.environ.get("NLLB_COMPUTE_TYPE", "int8"),
        intra_threads=int(os.environ.get("NLLB_INTRA_THREADS", "8")),
        device=os.environ.get("NLLB_DEVICE", "cpu"),
        max_batch=int(os.environ.get("NLLB_MAX_BATCH", "16")),
        max_text_len=int(os.environ.get("NLLB_MAX_TEXT_LEN", "500")),
        host=os.environ.get("SERVER_HOST", "127.0.0.1"),
        port=int(os.environ.get("SERVER_PORT", "8008")),
    )
