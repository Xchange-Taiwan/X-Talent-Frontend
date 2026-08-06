#!/usr/bin/env bash
# Claude Code Stop-hook adapter around the shared board-status check.
# Schema: https://docs.claude.com/en/docs/claude-code/hooks -- Stop hooks
# block by printing {"decision":"block","reason":"..."} to stdout and
# exiting 0.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REASON="$("$SCRIPT_DIR/../check-board-status.sh")"
STATUS=$?

if [ "$STATUS" -eq 1 ] && [ -n "$REASON" ]; then
  printf '{"decision":"block","reason":%s}\n' "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$REASON")"
fi
exit 0
