#!/usr/bin/env bash
# Starts Alice's local service, or reuses a current one. It never restarts a service during a session,
# never prints the key or env file, and talks only to 127.0.0.1.
set -euo pipefail
cd "$(dirname "$0")"

if [ "$#" -ne 0 ]; then echo 'Usage: bash poc/alice-run.sh   (takes no arguments)' >&2; exit 64; fi

# RN-2: Node as start.sh finds it.
node_bin="${ALICE_GOOD_MEETINGS_NODE:-$(command -v node || true)}"
if [ -z "$node_bin" ]; then node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
if [ ! -x "$node_bin" ]; then
  echo 'Node.js 22+ is required; set ALICE_GOOD_MEETINGS_NODE to its executable.' >&2
  exit 1
fi

# RN-3: PORT from the environment, else only the PORT= line of .env.local, else 3000.
port="${PORT:-}"
if [ -z "$port" ] && [ -f .env.local ]; then
  line="$(grep -m1 '^PORT=' .env.local || true)"
  port="$(printf '%s' "${line#PORT=}" | tr -d "\"' \r")"
fi
port="${port:-3000}"
case "$port" in ''|*[!0-9]*) echo 'PORT must be a number from 1 to 65535.' >&2; exit 64;; esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then echo 'PORT must be a number from 1 to 65535.' >&2; exit 64; fi
address="http://127.0.0.1:$port"

# RN-8: service sources are the poc/*.mjs files the service imports, plus .env.local.
sources="server.mjs agent.mjs session.mjs answer.mjs answer-area.mjs package-loader.mjs .env.local"

# RN-4: prints none, other, current or older <sessions>. A silent listener counts as another program.
probe() {
  "$node_bin" -e '
    const http = require("http"), fs = require("fs");
    const done = text => { console.log(text); process.exit(0); };
    const newest = () => Math.max(0, ...process.argv.slice(2).map(f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }));
    const request = http.get({ host: "127.0.0.1", port: Number(process.argv[1]), path: "/health", timeout: 2000 }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; if (body.length > 65536) { request.destroy(); done("other"); } });
      res.on("end", () => {
        try {
          const h = JSON.parse(body);
          if (res.statusCode === 200 && h.service === "alice-good-meetings" && Number.isInteger(h.startedAt)) {
            done(newest() > h.startedAt ? "older " + h.sessions : "current");
          }
        } catch {}
        done("other");
      });
    });
    request.on("timeout", () => { request.destroy(); done("other"); });
    request.on("error", e => done(e.code === "ECONNREFUSED" ? "none" : "other"));
    setTimeout(() => done("other"), 2500);
  ' "$port" $sources 2>/dev/null || echo other
}

stop_idle_service() {
  local pids pid i
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -z "$pids" ]; then echo "Cannot find the older Alice service on port $port to end it." >&2; exit 3; fi
  for pid in $pids; do kill -TERM "$pid" 2>/dev/null || true; done
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if [ "$(probe)" = none ]; then return 0; fi
    sleep 0.5
  done
  echo "The older Alice service on port $port did not end within 5 seconds; nothing was started." >&2
  exit 3
}

state="$(probe)"
case "$state" in
  other)
    echo "Port $port is answered by another program, not Alice. Nothing was started or stopped." >&2
    exit 2 ;;
  current)
    echo "Alice is already running and current: $address"
    exit 0 ;;
  "older 0")
    echo "Alice's service is older than its source or key file and no session is active; restarting it."
    stop_idle_service ;;
  older*)
    echo "Alice's service is older than its source or key file, but a session is active, so it was left running."
    echo "A restart is pending: run this command again after the session ends. Open $address"
    exit 0 ;;
esac

# RN-10: --env-file only when .env.local exists; the file's contents are never read or printed here.
args=(server.mjs)
if [ -f .env.local ]; then
  args=(--env-file=.env.local server.mjs)
else
  echo 'No poc/.env.local was found: question recognition and proposed answers are unavailable until a key is added.'
fi

"$node_bin" "${args[@]}" &
child=$!
trap 'kill -TERM "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; exit 0' INT TERM

# RN-11: print ready only after /health answers as this service; give up after 30 seconds.
deadline=$((SECONDS + 30))
while [ "$SECONDS" -lt "$deadline" ]; do
  if ! kill -0 "$child" 2>/dev/null; then echo 'The Alice service exited before it answered; see the lines above.' >&2; exit 3; fi
  if [ "$(probe)" = current ]; then
    echo "ready: $address"
    wait "$child"
    exit $?
  fi
  sleep 0.5
done
echo 'The Alice service did not answer within 30 seconds; stopping it.' >&2
kill -TERM "$child" 2>/dev/null || true
wait "$child" 2>/dev/null || true
exit 3
