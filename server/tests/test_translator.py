"""Fast tests: pure logic only. The 600M model is never loaded here.

Run `RUN_MODEL_TESTS=1 pytest` to also run the slow integration test at the bottom, which loads
the real model from NLLB_MODEL_DIR and does a real translation.
"""

import os

import pytest

from translator import LANG_CODE_RE, NllbTranslator, TranslationError


@pytest.mark.parametrize("code", ["eng_Latn", "kor_Hang", "jpn_Jpan", "zho_Hans", "arb_Arab"])
def test_lang_code_regex_accepts_flores200_shape(code):
    assert LANG_CODE_RE.match(code)


@pytest.mark.parametrize(
    "code",
    ["english", "eng", "eng-Latn", "ENG_LATN", "eng_latn", "eng_Latn ", " eng_Latn", "", "eng_Lat"],
)
def test_lang_code_regex_rejects_other_shapes(code):
    assert not LANG_CODE_RE.match(code)


def test_is_known_lang_caches_and_rejects_malformed_without_tokenizer_lookup():
    translator = NllbTranslator.__new__(NllbTranslator)  # skip __init__, no model/tokenizer needed
    translator._known_lang_ids = {}
    # Malformed codes are rejected by the regex before any tokenizer lookup, so this must not
    # raise even though translator._tokenizer was never set.
    assert translator.is_known_lang("not-a-code") is False
    assert translator.is_known_lang("") is False


@pytest.mark.skipif(os.environ.get("RUN_MODEL_TESTS") != "1", reason="set RUN_MODEL_TESTS=1 to load the real model")
def test_translate_batch_produces_hangul_for_korean_target():
    from config import load_settings

    translator = NllbTranslator(load_settings())
    [translation] = translator.translate_batch(["Hello, the weather is nice today."], "eng_Latn", "kor_Hang")
    assert translation
    assert any("가" <= ch <= "힣" for ch in translation), translation


@pytest.mark.skipif(os.environ.get("RUN_MODEL_TESTS") != "1", reason="set RUN_MODEL_TESTS=1 to load the real model")
def test_translate_batch_rejects_unknown_language():
    from config import load_settings

    translator = NllbTranslator(load_settings())
    with pytest.raises(TranslationError):
        translator.translate_batch(["hi"], "eng_Latn", "xxx_Xxxx")
