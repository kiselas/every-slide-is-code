#!/usr/bin/env bash
# Builds deck-kit.zip for uploading the skill to ChatGPT or Claude.ai:
# a deck-kit/ folder with SKILL.md, the reference, the runtime, the template and the exporter, without examples/.
# Usage: bash scripts/pack-skill.sh [out.zip]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-deck-kit.zip}"
git archive --format=zip --prefix=deck-kit/ -o "$OUT" HEAD \
  SKILL.md LICENSE sources.md [0-9][0-9]-*.md \
  runtime/deck.js runtime/deck.css template/deck.html scripts/sync-runtime.mjs \
  export/README.md export/package.json export/deck.mjs
echo "skill archive: $OUT"
