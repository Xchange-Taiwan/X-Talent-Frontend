$_TrackerVars = (& node (Join-Path $PSScriptRoot "tracker-ops.mjs") load-config --format=ps1); if ($LASTEXITCODE -ne 0 -or -not $_TrackerVars) { throw "ERROR: project-config.md is malformed or missing JSON block — aborting" }
Invoke-Expression ($_TrackerVars -join "`n")
