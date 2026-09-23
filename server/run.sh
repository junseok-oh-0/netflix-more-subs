#!/usr/bin/env bash
# Starts the local NLLB translation server. See docs/NLLB_TRANSLATION.md for env vars.
set -euo pipefail
cd "$(dirname "$0")"
source ~/.venv_global/bin/activate
exec python -m uvicorn app:app --host "${SERVER_HOST:-127.0.0.1}" --port "${SERVER_PORT:-8008}"
