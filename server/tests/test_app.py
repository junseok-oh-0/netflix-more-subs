"""Endpoint tests using a fake translator — no model load, runs in milliseconds."""

from fastapi.testclient import TestClient

from app import create_app
from config import load_settings
from translator import TranslationError


class FakeTranslator:
    def translate_batch(self, texts, source_lang, target_lang):
        if target_lang == "xxx_Xxxx":
            raise TranslationError(f"unknown target_lang: {target_lang!r}")
        if target_lang == "zzz_Zzzz":
            raise RuntimeError("simulated ctranslate2 failure")
        return [f"[{source_lang}->{target_lang}] {t}" for t in texts]


def make_client(**settings_overrides):
    settings = load_settings()
    if settings_overrides:
        settings = type(settings)(**{**settings.__dict__, **settings_overrides})
    app = create_app(settings=settings, translator=FakeTranslator())
    return TestClient(app)


def test_health_reports_model_loaded_and_settings():
    with make_client() as client:
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["device"] == load_settings().device


def test_translate_happy_path():
    with make_client() as client:
        r = client.post(
            "/translate",
            json={"texts": ["Hello"], "source_lang": "eng_Latn", "target_lang": "kor_Hang"},
        )
    assert r.status_code == 200
    assert r.json() == {"translations": ["[eng_Latn->kor_Hang] Hello"]}


def test_translate_batch_of_multiple_lines():
    with make_client() as client:
        r = client.post(
            "/translate",
            json={"texts": ["a", "b", "c"], "source_lang": "eng_Latn", "target_lang": "kor_Hang"},
        )
    assert r.status_code == 200
    assert len(r.json()["translations"]) == 3


def test_translate_rejects_empty_texts():
    with make_client() as client:
        r = client.post("/translate", json={"texts": [], "source_lang": "eng_Latn", "target_lang": "kor_Hang"})
    assert r.status_code == 422


def test_translate_rejects_malformed_language_code():
    with make_client() as client:
        r = client.post(
            "/translate", json={"texts": ["hi"], "source_lang": "english", "target_lang": "kor_Hang"}
        )
    assert r.status_code == 422


def test_translate_rejects_batch_over_max():
    with make_client(max_batch=2) as client:
        r = client.post(
            "/translate",
            json={"texts": ["a", "b", "c"], "source_lang": "eng_Latn", "target_lang": "kor_Hang"},
        )
    assert r.status_code == 422
    assert "max 2" in r.json()["detail"]


def test_translate_rejects_text_over_max_len():
    with make_client(max_text_len=5) as client:
        r = client.post(
            "/translate",
            json={"texts": ["way too long"], "source_lang": "eng_Latn", "target_lang": "kor_Hang"},
        )
    assert r.status_code == 422
    assert "max 5" in r.json()["detail"]


def test_translate_maps_translation_error_to_422():
    with make_client() as client:
        r = client.post(
            "/translate", json={"texts": ["hi"], "source_lang": "eng_Latn", "target_lang": "xxx_Xxxx"}
        )
    assert r.status_code == 422
    assert "xxx_Xxxx" in r.json()["detail"]


def test_translate_maps_unexpected_error_to_500():
    with make_client() as client:
        r = client.post(
            "/translate", json={"texts": ["hi"], "source_lang": "eng_Latn", "target_lang": "zzz_Zzzz"}
        )
    assert r.status_code == 500
    assert "simulated ctranslate2 failure" in r.json()["detail"]


def test_translate_503_when_model_not_loaded_yet():
    # A bare (non-context-manager) TestClient never runs the lifespan startup hook, so
    # app.state.translator stays None here without ever touching the real model — this simulates
    # a request that arrives before the model finishes loading.
    app = create_app(settings=load_settings(), translator=None)
    client = TestClient(app)
    r = client.post("/translate", json={"texts": ["hi"], "source_lang": "eng_Latn", "target_lang": "kor_Hang"})
    assert r.status_code == 503
