#!/usr/bin/env bash
_TRACKER_VARS="$(node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tracker-ops.mjs" load-config --format=sh)" || { return 1 2>/dev/null || exit 1; }
eval "$_TRACKER_VARS"
