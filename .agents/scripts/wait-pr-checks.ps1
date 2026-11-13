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
  $RawPr = (gh pr view $PrNumber --repo "$ORG/$FRONTEND_REPO" --json headRefName,headRefOid,state,mergeable,labels,statusCheckRollup 2>$null)
  if ($RawPr) {
    try {
      $LatestPr = $RawPr | ConvertFrom-Json
      if ($null -ne $LatestPr) {
        $PrObj = $LatestPr
        $Checks = if ($null -ne $PrObj.statusCheckRollup) { @($PrObj.statusCheckRollup) } else { @() }
        if ($Checks.Count -gt 0) {
          $Pending = 0
          $HasAnyAiReview = $false
          $HasFinalSummary = $false
          foreach ($c in $Checks) {
            $name = "$($c.name)$($c.context)"
            $typename = if ($c.__typename) { "$($c.__typename)" } elseif ($c.context -and -not $c.status) { "StatusContext" } else { "CheckRun" }
            $statusUpper = "$($c.status)".ToUpper()
            $stateUpper = "$($c.state)".ToUpper()
            $concUpper = "$($c.conclusion)".ToUpper()
            if ($name -match "(?i)AI Review") {
              $HasAnyAiReview = $true
            }
            if ($name -match "AI Review: Final Summary" -and $statusUpper -eq "COMPLETED") {
              $HasFinalSummary = $true
            }
            $isPending = if ($typename -eq "StatusContext") {
              $stateUpper -in @("PENDING", "EXPECTED")
            } else {
              $statusUpper -ne "COMPLETED"
            }
            if ($isPending) {
              $Pending++
            }
          }
          $AiReviewSettled = $HasFinalSummary -or ((-not $HasAnyAiReview) -and ($Checks.Count -ge 5))
          if ($Pending -eq 0 -and $AiReviewSettled) {
            break
          }
        }
      }
    } catch {}
  }
  Start-Sleep -Seconds 15
}

$AllChecks = if ($null -ne $PrObj -and $null -ne $PrObj.statusCheckRollup) { @($PrObj.statusCheckRollup) } else { @() }
$Labels = if ($null -ne $PrObj -and $null -ne $PrObj.labels) { @($PrObj.labels | ForEach-Object { "$($_.name)" }) } else { @() }
$HeadSha = if ($null -ne $PrObj -and $PrObj.headRefOid) { "$($PrObj.headRefOid)".Trim().ToLower() } else { "" }

$FinalSummaryCheck = $AllChecks | Where-Object { "$($_.name)$($_.context)" -match "AI Review: Final Summary" } | Select-Object -First 1
$FinalSummarySkipped = ($null -ne $FinalSummaryCheck) -and ("$($FinalSummaryCheck.status)".ToUpper() -eq "COMPLETED") -and ("$($FinalSummaryCheck.conclusion)".ToUpper() -eq "SKIPPED")

$RawComments = (gh pr view $PrNumber --repo "$ORG/$FRONTEND_REPO" --json comments 2>$null)
$CommentsList = @()
$RiskLevel = if ($FinalSummarySkipped) { "low" } else { "unknown" }
$FindingsExcerpt = ""
if ($RawComments) {
  try {
    $CommentsObj = $RawComments | ConvertFrom-Json
    if ($null -ne $CommentsObj -and $null -ne $CommentsObj.comments) {
      $CommentsList = @($CommentsObj.comments)
    }
    if (-not $FinalSummarySkipped) {
      $AiComment = $CommentsList | Where-Object {
        $isBot = ($_.author.login -in @("github-actions", "github-actions[bot]"))
        $bodyStr = "$($_.body)"
        if (-not $isBot -or ($bodyStr -notmatch "<!-- ai-review-pipeline -->")) { return $false }
        $shaTag = [regex]::Match($bodyStr, '(?i)<!--\s*ai-review-sha:([0-9a-f]+)\s*-->')
        if ($shaTag.Success -and $HeadSha) {
          $tagged = $shaTag.Groups[1].Value.ToLower()
          return $HeadSha.StartsWith($tagged) -or $tagged.StartsWith($HeadSha)
        }
        return $true
      } | Select-Object -Last 1
      if ($AiComment -and $AiComment.body) {
        $m = [regex]::Match($AiComment.body, '(?i)### ⚠️ Overall Risk\s+\*\*([a-z]+)\*\*')
        if ($m.Success) { $RiskLevel = $m.Groups[1].Value.ToLower() }
        if ($RiskLevel -ne "low") {
          $FindingsExcerpt = $AiComment.body.Substring(0, [Math]::Min(3500, $AiComment.body.Length))
        }
      }
    }
  } catch {}
}

$LatestQuotaComment = $CommentsList | Where-Object { "$($_.body)" -match "(?i)vercel-quota-limit|api-deployments-free-per-day|Resource is limited - try again in" } | Select-Object -Last 1
$QuotaCommentMatchesHead = $false
if ($LatestQuotaComment) {
  $qMatch = [regex]::Match("$($LatestQuotaComment.body)", '(?i)<!--\s*vercel-quota-limit:sha=([0-9a-f]+)\s*-->')
  if ($qMatch.Success -and $HeadSha) {
    $qSha = $qMatch.Groups[1].Value.ToLower()
    $QuotaCommentMatchesHead = $HeadSha.StartsWith($qSha) -or $qSha.StartsWith($HeadSha)
  } elseif (-not $HeadSha) {
    $QuotaCommentMatchesHead = $true
  }
}

$VercelQuotaReached = ($Labels -contains "vercel-quota-limit") -or
  $QuotaCommentMatchesHead -or
  (($AllChecks | Where-Object { ("$($_.name)$($_.context)" -match "(?i)vercel") -and ("$($_.description)$($_.title)" -match "(?i)api-deployments-free-per-day|Resource is limited") }).Count -gt 0)

$FailedChecks = @()
foreach ($c in $AllChecks) {
  $name = if ($c.name) { "$($c.name)" } else { "$($c.context)" }
  $typename = if ($c.__typename) { "$($c.__typename)" } elseif ($c.context -and -not $c.status) { "StatusContext" } else { "CheckRun" }
  $statusUpper = "$($c.status)".ToUpper()
  $stateUpper = "$($c.state)".ToUpper()
  $concUpper = "$($c.conclusion)".ToUpper()
  $isCompleted = if ($typename -eq "StatusContext") {
    ($stateUpper -notin @("PENDING", "EXPECTED", ""))
  } else {
    ($statusUpper -eq "COMPLETED")
  }
  $effectiveResult = if ($typename -eq "StatusContext") { $stateUpper } else { $concUpper }
  if (-not $isCompleted) {
    if ($VercelQuotaReached -and ($name -match "(?i)vercel|deploy pr preview")) {
      continue
    }
    $lbl = if ($statusUpper) { $statusUpper } elseif ($stateUpper) { $stateUpper } else { "PENDING" }
    $FailedChecks += "$name ($lbl)"
  } elseif ($effectiveResult -notin @("SUCCESS", "NEUTRAL", "SKIPPED")) {
    if ($VercelQuotaReached -and ($name -match "(?i)vercel|deploy pr preview")) {
      continue
    }
    $lbl = if ($effectiveResult) { $effectiveResult } else { "FAILED" }
    $FailedChecks += "$name ($lbl)"
  }
}

$Mergeable = if ($null -ne $PrObj) { "$($PrObj.mergeable)" } else { "" }
if ($Mergeable -eq "CONFLICTING") {
  $FailedChecks += "Merge Conflict against base branch (CONFLICTING)"
}
$TotalChecks = $AllChecks.Count

Write-Host "=== PR #$PrNumber CI & AI REVIEW SUMMARY ==="
Write-Host "Total checks: $TotalChecks | Mergeable: $Mergeable | Failed: $($FailedChecks.Count) | AI Review Overall Risk: $RiskLevel | VercelQuotaLimit: $VercelQuotaReached"
if ($VercelQuotaReached) {
  Write-Host "VERCEL_LIMIT=true"
}
if ($FailedChecks.Count -gt 0) {
  Write-Host ("Failed checks:`n  - " + ($FailedChecks -join "`n  - "))
}

if ($TotalChecks -gt 0 -and $FailedChecks.Count -eq 0 -and $RiskLevel -eq "low") {
  Write-Host "CONVERGED=true"
  Write-Host "✅ All CI checks passed and AI Review risk is low. No fixes needed!"
} else {
  Write-Host "CONVERGED=false"
  if ($FindingsExcerpt) {
    Write-Host "`n=== AI REVIEW FINDINGS ===`n$FindingsExcerpt"
  }
}
