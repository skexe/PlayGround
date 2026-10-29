#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
export OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export PORT="${PORT:-3000}"
/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
/usr/bin/time -p /usr/bin/printf '{"project":"%s","directory":"%s"}\n' "$PWD" "$PWD/dist" > "$OPENCODE_WEB_DIR/deployment-output.json"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-start.mjs"
