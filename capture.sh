#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
: "${CAPTURE_URL:?Set CAPTURE_URL to the preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source.}"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
