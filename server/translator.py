"""NLLB translation wrapper around CTranslate2 + a HuggingFace tokenizer.

Loading is expensive (model + tokenizer), so a single Translator instance is created once and
reused. Calls are serialized with a lock: CTranslate2 already parallelizes internally via
intra_threads, so letting two requests run concurrently would oversubscribe the CPU rather than
speed anything up.
"""

import re
import threading
from typing import Sequence

import ctranslate2
import transformers

from config import Settings

# FLORES-200 codes look like "eng_Latn": 3-letter language + underscore + 4-letter script.
LANG_CODE_RE = re.compile(r"^[a-z]{3}_[A-Z][a-z]{3}$")


class TranslationError(Exception):
    """Raised for request-level problems the caller should see as a 4xx/5xx, not a crash."""


class NllbTranslator:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._translator = ctranslate2.Translator(
            settings.model_dir,
            device=settings.device,
            compute_type=settings.compute_type,
            intra_threads=settings.intra_threads,
        )
        self._tokenizer = transformers.AutoTokenizer.from_pretrained(settings.tokenizer_id)
        self._known_lang_ids: dict[str, int] = {}

    def is_known_lang(self, code: str) -> bool:
        """True if `code` is a language the tokenizer actually has a token for."""
        if not LANG_CODE_RE.match(code):
            return False
        if code not in self._known_lang_ids:
            token_id = self._tokenizer.convert_tokens_to_ids(code)
            unk_id = self._tokenizer.unk_token_id
            self._known_lang_ids[code] = token_id if token_id != unk_id else -1
        return self._known_lang_ids[code] != -1

    def warmup(self) -> None:
        """Runs one throwaway translation so the first real request isn't the slow one."""
        self.translate_batch(["hello"], "eng_Latn", "kor_Hang")

    def translate_batch(self, texts: Sequence[str], source_lang: str, target_lang: str) -> list[str]:
        if not self.is_known_lang(source_lang):
            raise TranslationError(f"unknown source_lang: {source_lang!r}")
        if not self.is_known_lang(target_lang):
            raise TranslationError(f"unknown target_lang: {target_lang!r}")

        with self._lock:
            self._tokenizer.src_lang = source_lang
            batch = [self._tokenizer.convert_ids_to_tokens(self._tokenizer.encode(t)) for t in texts]
            target_prefix = [[target_lang]] * len(batch)
            results = self._translator.translate_batch(
                batch, target_prefix=target_prefix, max_batch_size=len(batch) or 1
            )
            return [
                self._tokenizer.decode(
                    self._tokenizer.convert_tokens_to_ids(r.hypotheses[0][1:]),
                    skip_special_tokens=True,
                )
                for r in results
            ]
