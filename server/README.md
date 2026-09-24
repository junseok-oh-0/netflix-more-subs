# Translation Server (local NLLB)

A local translation server (FastAPI + CTranslate2) that backs the "Local Server (NLLB)" translation
engine in the Netflix More Subs extension. It runs entirely on your machine — no text is sent to a
third-party translation API.

For the design rationale and the integration work log, see
[docs/NLLB_TRANSLATION.md](../docs/NLLB_TRANSLATION.md). This file covers setup and day-to-day usage.

## 1. Install dependencies
```bash
pip install -r requirements.txt
```
This installs `fastapi`, `uvicorn`, `ctranslate2`, `transformers`, and `sentencepiece`. Use a virtual
environment of your choice. Note that `torch` is **not** required to run the server — inference runs
in CTranslate2's C++ core, and tokenization uses the sentencepiece-based slow tokenizer.

## 2. Set up the model (one-time)
The server doesn't ship with model weights — you need to convert an NLLB model to CTranslate2 format
once, using the `ct2-transformers-converter` CLI (installed alongside the `ctranslate2` package).

Conversion needs `torch` in addition to the packages above, since it loads the original Hugging Face
model to extract its weights:
```bash
pip install torch
```

Then convert:
```bash
ct2-transformers-converter \
  --model facebook/nllb-200-distilled-600M \
  --output_dir ~/libs/models/nllb-200-distilled-600M-int8-ct2 \
  --quantization int8
```
- This downloads `facebook/nllb-200-distilled-600M` from Hugging Face on first run, so it needs
  internet access and a few GB of free disk space (original weights plus the quantized copy).
- `--output_dir` can be any path — point `NLLB_MODEL_DIR` (see below) at it if it differs from the
  default shown above.
- `--quantization int8` matches this server's default `NLLB_COMPUTE_TYPE` (below). If you convert
  with a different quantization (e.g. `float16` on a GPU), set `NLLB_COMPUTE_TYPE` to match.
- On success, `output_dir` contains the compiled CTranslate2 model (`model.bin`, `config.json`,
  `shared_vocabulary.json`, and similar files).

The tokenizer is *not* part of the converted model — it's loaded separately from
`facebook/nllb-200-distilled-600M` via `transformers.AutoTokenizer` when the server starts, and is
cached locally (Hugging Face's usual cache directory) on first run.

## 3. Configuration
All environment variables are optional; defaults are in `config.py`.

| Variable | Default | Description |
|---|---|---|
| `NLLB_MODEL_DIR` | `~/libs/models/nllb-200-distilled-600M-int8-ct2` | CTranslate2 model directory (from step 2) |
| `NLLB_TOKENIZER_ID` | `facebook/nllb-200-distilled-600M` | Hugging Face tokenizer ID |
| `NLLB_COMPUTE_TYPE` | `int8` | CTranslate2 compute precision |
| `NLLB_INTRA_THREADS` | `8` | CTranslate2 internal thread count |
| `NLLB_DEVICE` | `cpu` | `cpu` or `cuda` |
| `NLLB_MAX_BATCH` | `16` | Max sentences per request |
| `NLLB_MAX_TEXT_LEN` | `500` | Max characters per sentence |
| `SERVER_HOST` | `127.0.0.1` | |
| `SERVER_PORT` | `8008` | |

## 4. Run
```bash
cd server
python -m uvicorn app:app --host 127.0.0.1 --port 8008
```
Or use the `run.sh` helper (edit the venv path at the top of the script for your environment first).

Check it's up:
```bash
curl http://127.0.0.1:8008/health
# {"status":"ok","model_loaded":true,"device":"cpu","compute_type":"int8"}
```

Point the extension at it from the popup: set Translator to "Local Server (NLLB)", then Source
Language, Target Language, and Server URL (default `http://127.0.0.1:8008`).

## 5. API
```
GET /health
  -> 200 {"status":"ok","model_loaded":true,"device":"cpu","compute_type":"int8"}

POST /translate
  body: {"texts":["Hello, world."],"source_lang":"eng_Latn","target_lang":"kor_Hang"}
  -> 200 {"translations":["안녕, 세상."]}
  -> 422 (validation failure: empty texts, malformed language code, batch/length over the max)
  -> 500 {"detail":"..."} (translation runtime error, e.g. an unknown language code)
```
Language codes use the FLORES-200 format (`eng_Latn`, `kor_Hang`, etc.).

```bash
curl -s -X POST http://127.0.0.1:8008/translate \
  -H 'content-type: application/json' \
  -d '{"texts":["Hello, the weather is nice today."],"source_lang":"eng_Latn","target_lang":"kor_Hang"}'
```

## 6. Tests
```bash
cd server
pytest                        # fast tests only (translator is mocked)
RUN_MODEL_TESTS=1 pytest      # includes tests that load the real model
```
Run from inside `server/` — `pyproject.toml`'s `pythonpath = ["."]` is what makes `import app` etc.
resolve.
