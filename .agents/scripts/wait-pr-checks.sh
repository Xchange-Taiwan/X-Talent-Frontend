#!/usr/bin/env bash
# Thin wrapper delegating to `.agents/scripts/wait-pr-checks.mjs` so Bash and
# PowerShell share a single unit-tested PR check & AI Review convergence implementation.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-config.sh" 2>/dev/null || true
export ORG="${ORG:-Xchange-Taiwan}"
export FRONTEND_REPO="${FRONTEND_REPO:-X-Talent-Frontend}"
exec node "$SCRIPT_DIR/wait-pr-checks.mjs" "$@"
