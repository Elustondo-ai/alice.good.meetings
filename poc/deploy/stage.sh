#!/usr/bin/env bash
# Copies only the files named in publish-files.txt into poc/deploy/.stage and prints them.
# It uploads nothing and deploys nothing; the commands that do are in poc/deploy/README.md and are Pablo's to run.
set -euo pipefail
cd "$(dirname "$0")/../.."
stage="poc/deploy/.stage"
rm -rf "$stage"
mkdir -p "$stage"
while IFS= read -r path; do
  case "$path" in ''|'#'*) continue ;; esac
  case "$path" in /*|*..*) echo "Refused path: $path" >&2; exit 64 ;; esac
  if [ ! -e "$path" ]; then echo "Missing: $path" >&2; exit 1; fi
  mkdir -p "$stage/$(dirname "$path")"
  cp -R "$path" "$stage/$path"
done < poc/deploy/publish-files.txt
cp poc/deploy/Dockerfile poc/deploy/.dockerignore "$stage/"
# A last check on the copy itself: nothing private may be in it, whatever the list says.
private="$(find "$stage" \( -name '.env*' -o -name '*.jsonl' -o -name 'node_modules' -o -path '*/context/*' -o -path '*/logs/*' -o -name '*.test.mjs' \) -print)"
if [ -n "$private" ]; then echo "Private or test files in the stage; nothing may be published:" >&2; echo "$private" >&2; exit 1; fi
( cd "$stage" && find . -type f | sed 's|^\./||' | LC_ALL=C sort )
echo "Staged $(find "$stage" -type f | wc -l | tr -d ' ') files, $(du -sh "$stage" | cut -f1 | tr -d ' '), in $stage"
