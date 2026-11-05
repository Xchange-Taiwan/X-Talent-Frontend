# Quietly waits for GitHub Actions PR checks (including AI Review: Final Summary)
# to complete without flooding the AI agent's context window with repeated
# polling tables. Once finished, prints a compact summary (< 30 lines) showing
# whether the PR converged or the exact findings/failures that need fixing.
#
# Usage:
#   & .agents/scripts/wait-pr-checks.ps1 [<PrNumberOrUrl>]

param(
  [Parameter(Position = 0)]
  [string]$PrNumberOrUrl = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
try { . (Join-Path $ScriptDir "load-config.ps1") } catch {}

if (-not $ORG) { $ORG = "Xchange-Taiwan" }
if (-not $FRONTEND_REPO) { $FRONTEND_REPO = "X-Talent-Frontend" }

if (-not [string]::IsNullOrWhiteSpace($PrNumberOrUrl)) {
  $PrNumber = (gh pr view "$PrNumberOrUrl" --repo "$ORG/$FRONTEND_REPO" --json number --jq '.number' 2>$null)
} else {
  $PrNumber = (gh pr view --repo "$ORG/$FRONTEND_REPO" --json number --jq '.number' 2>$null)
}

if ([string]::IsNullOrWhiteSpace($PrNumber)) {
  throw "ERROR: Could not resolve open PR number. Run /submit-pr first."
}

$PrObj = $null
for ($i = 1; $i -le 60; $i++) {
  $RawPr = (gh pr view $PrNumber --repo "$ORG/$FRONTEND_REPO" --json headRefName,state,mergeable,statusCheckRollup 2>$null)
  if ($RawPr) {
    try {
      $PrObj = $RawPr | ConvertFrom-Json
      $Checks = @($PrObj.statusCheckRollup)
      if ($Checks.Count -gt 0) {
        $Pending = 0
        $HasFinalSummary = $false
        foreach ($c in $Checks) {
          $name = "$($c.name)$($c.context)"
          $state = "$($c.status)$($c.state)"
          $conc = "$($c.conclusion)"
          if ($name -match "AI Review: Final Summary" -and ($conc -in @("SUCCESS", "NEUTRAL", "SKIPPED"))) {
            $HasFinalSummary = $true
          }
          if ($state -match "IN_PROGRESS|QUEUED|PENDING" -or (-not $conc -and $state -ne "SUCCESS")) {
            $Pending++
          }
        }
        if ($Pending -eq 0 -and ($HasFinalSummary -or $Checks.Count -ge 5)) {
          break
        }
      }
    } catch {}
  }
  Start-Sleep -Seconds 15
}

$FailedChecks = @()
foreach ($c in @($PrObj.statusCheckRollup)) {
  $name = if ($c.name) { $c.name } else { $c.context }
  $conc = if ($c.conclusion) { $c.conclusion } else { $c.state }
  if ($conc -and ($conc -notin @("SUCCESS", "NEUTRAL", "SKIPPED"))) {
    $FailedChecks += "$name ($conc)"
  }
}

$RawComments = (gh pr view $PrNumber --repo "$ORG/$FRONTEND_REPO" --json comments 2>$null)
$RiskLevel = "unknown"
$FindingsExcerpt = ""
if ($RawComments) {
  try {
    $CommentsObj = $RawComments | ConvertFrom-Json
    $AiComment = @($CommentsObj.comments) | Where-Object {
      ($_.author.login -in @("github-actions", "github-actions[bot]")) -and
      ($_.body -match "<!-- ai-review-pipeline -->")
    } | Select-Object -Last 1
    if ($AiComment -and $AiComment.body) {
      $m = [regex]::Match($AiComment.body, '(?i)### ⚠️ Overall Risk\s+\*\*([a-z]+)\*\*')
      if ($m.Success) { $RiskLevel = $m.Groups[1].Value.ToLower() }
      if ($RiskLevel -ne "low") {
        $FindingsExcerpt = $AiComment.body.Substring(0, [Math]::Min(3500, $AiComment.body.Length))
      }
    }
  } catch {}
}

Write-Host "=== PR #$PrNumber CI & AI REVIEW SUMMARY ==="
Write-Host "Total checks: $(@($PrObj.statusCheckRollup).Count) | Failed: $($FailedChecks.Count) | AI Review Overall Risk: $RiskLevel"
if ($FailedChecks.Count -gt 0) {
  Write-Host ("Failed checks:`n  - " + ($FailedChecks -join "`n  - "))
}

if ($FailedChecks.Count -eq 0 -and ($RiskLevel -in @("low", "unknown"))) {
  Write-Host "CONVERGED=true"
  Write-Host "✅ All CI checks passed and AI Review risk is low. No fixes needed!"
} else {
  Write-Host "CONVERGED=false"
  if ($FindingsExcerpt) {
    Write-Host "`n=== AI REVIEW FINDINGS ===`n$FindingsExcerpt"
  }
}
