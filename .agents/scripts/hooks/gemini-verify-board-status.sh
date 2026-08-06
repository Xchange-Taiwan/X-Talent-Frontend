#!/usr/bin/env bash
# Gemini CLI AfterAgent-hook adapter around the shared board-status check.
# Schema: https://geminicli.com/docs/hooks/reference/ -- AfterAgent hooks
# reject/retry by printing {"decision":"deny","reason":"..."} to stdout and
# exiting 0.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REASON="$("$SCRIPT_DIR/../check-board-status.sh")"
STATUS=$?

if [ "$STATUS" -eq 1 ] && [ -n "$REASON" ]; then
  printf '{"decision":"deny","reason":%s}\n' "$(REASON="$REASON" node -e 'console.log(JSON.stringify(process.env.REASON))')"
fi
exit 0
