#!/usr/bin/env bash
set -euo pipefail
exec node "$(dirname "$0")/../../scripts/cloud/submit-pr.mjs" "$@"
