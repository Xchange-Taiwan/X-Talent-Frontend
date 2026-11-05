#!/usr/bin/env bash
# Thin POSIX wrapper around the cross-platform Node.js implementation.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/link-ticket-branch.mjs" "$@"
