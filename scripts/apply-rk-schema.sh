#!/usr/bin/env bash
# Alias — usa seed-db.sh
if [ "${1:-}" = "discover" ]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib-insforge.sh"
  discover_pg_print
  exit $?
fi
exec "$(dirname "$0")/seed-db.sh" "$@"

