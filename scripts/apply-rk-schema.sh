#!/usr/bin/env bash
# Alias — usa seed-db.sh
exec "$(dirname "$0")/seed-db.sh" "$@"
