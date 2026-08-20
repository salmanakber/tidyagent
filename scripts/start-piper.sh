#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv-piper"
VOICE_DIR="$ROOT/voices/piper"
VOICE="${PIPER_VOICE:-en_US-lessac-medium}"
PORT="${PIPER_PORT:-5510}"

if [ ! -x "$VENV/bin/python" ]; then
  bash "$ROOT/scripts/setup-piper.sh"
fi

exec "$VENV/bin/python" -m piper.http_server -m "$VOICE" --host 127.0.0.1 --port "$PORT" --data-dir "$VOICE_DIR"
