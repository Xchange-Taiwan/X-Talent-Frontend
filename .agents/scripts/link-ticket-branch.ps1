# Thin PowerShell wrapper around the cross-platform Node.js implementation.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $ScriptDir "link-ticket-branch.mjs") @args
exit $LASTEXITCODE
