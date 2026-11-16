& node (Join-Path $PSScriptRoot "tracker-ops.mjs") wait-pr-checks @args
exit $LASTEXITCODE
