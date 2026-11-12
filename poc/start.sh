#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
speakercoach_node="${SPEAKERCOACH_NODE:-$(command -v node || true)}"
if [ -z "$speakercoach_node" ]; then
  speakercoach_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$speakercoach_node" ]; then
  echo 'Node.js 22+ is required; set SPEAKERCOACH_NODE to its executable.' >&2
  exit 1
fi
exec "$speakercoach_node" --env-file=.env.local server.mjs
