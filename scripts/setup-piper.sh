#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv-piper"
VOICE_DIR="$ROOT/voices/piper"
VOICE="${PIPER_VOICE:-en_US-lessac-medium}"

mkdir -p "$VOICE_DIR"
if [ ! -x "$VENV/bin/python" ]; then
  python3.11 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q -U pip
"$VENV/bin/pip" install -q "piper-tts[http]"
"$VENV/bin/python" -m piper.download_voices --data-dir "$VOICE_DIR" "$VOICE"
echo "Piper ready. Voice: $VOICE"
