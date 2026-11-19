#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
alice_good_meetings_node="${ALICE_GOOD_MEETINGS_NODE:-$(command -v node || true)}"
if [ -z "$alice_good_meetings_node" ]; then
  alice_good_meetings_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$alice_good_meetings_node" ]; then
  echo 'Node.js 22+ is required; set ALICE_GOOD_MEETINGS_NODE to its executable.' >&2
  exit 1
fi
exec "$alice_good_meetings_node" --env-file=.env.local server.mjs
