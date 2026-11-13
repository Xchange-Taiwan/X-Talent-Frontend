# Thin wrapper delegating to `.agents/scripts/wait-pr-checks.mjs` so PowerShell and
# Bash share a single unit-tested PR check & AI Review convergence implementation.
param(
  [Parameter(Position = 0)]
  [string]$PrNumberOrUrl = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
try { . (Join-Path $ScriptDir "load-config.ps1") } catch {}
if ($ORG) { $env:ORG = $ORG }
if ($FRONTEND_REPO) { $env:FRONTEND_REPO = $FRONTEND_REPO }

if (-not [string]::IsNullOrWhiteSpace($PrNumberOrUrl)) {
  & node (Join-Path $ScriptDir "wait-pr-checks.mjs") $PrNumberOrUrl
} else {
  & node (Join-Path $ScriptDir "wait-pr-checks.mjs")
}
exit $LASTEXITCODE
