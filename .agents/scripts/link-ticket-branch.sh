#!/usr/bin/env bash
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tracker-ops.mjs" link-ticket-branch "$@"
