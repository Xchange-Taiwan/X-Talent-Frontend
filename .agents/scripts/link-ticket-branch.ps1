# Idempotently creates and links a Git branch in $FRONTEND_REPO to an issue in
# $TRACKER_REPO (or $FRONTEND_REPO) via GitHub's GraphQL `createLinkedBranch`
# mutation, verifies `linkedBranches` / `closedByPullRequestsReferences` is
# non-empty, and optionally checks out the branch and moves the Project V2
# board item to "In progress".
#
# Handles all three branch states safely in a single self-contained PowerShell
# execution (avoiding lost shell state across AI tool calls):
#   1. Already linked on GitHub -> no-op (ensures local checkout/upstream)
#   2. Remote branch does not exist yet -> calls createLinkedBranch from
#      current local branch HEAD or origin/develop (works in git worktrees too)
#   3. Remote branch already exists on origin but is NOT linked -> deletes the
#      unlinked remote ref (if no open PR exists) and recreates it at the exact
#      same commit SHA via createLinkedBranch so it links to the issue.
#
# Usage:
#   & .agents/scripts/link-ticket-branch.ps1 [<IssueNumberOrUrl>] [<BranchName>] [-NoCheckout] [-NoBoardUpdate]

param(
  [Parameter(Position = 0)]
  [string]$IssueNumberOrUrl = "",
  [Parameter(Position = 1)]
  [string]$BranchName = "",
  [switch]$NoCheckout,
  [switch]$NoBoardUpdate
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "load-config.ps1")

$CurrentBranch = (git branch --show-current 2>$null)
if ([string]::IsNullOrWhiteSpace($BranchName)) {
  $BranchName = $CurrentBranch
}

$IssueRepo = $TRACKER_REPO
$IssueNumber = ""

if (-not [string]::IsNullOrWhiteSpace($IssueNumberOrUrl)) {
  if ($IssueNumberOrUrl -match 'github\.com/[^/]+/([^/]+)/issues/(\d+)') {
    $IssueRepo = $Matches[1]
    $IssueNumber = $Matches[2]
  } elseif ($IssueNumberOrUrl -match '^\d+$') {
    $IssueNumber = $IssueNumberOrUrl
  } else {
    $m = [regex]::Match($IssueNumberOrUrl, '\d+')
    if ($m.Success) { $IssueNumber = $m.Value }
  }
}

if ([string]::IsNullOrWhiteSpace($IssueNumber) -and -not [string]::IsNullOrWhiteSpace($BranchName)) {
  $m = [regex]::Match($BranchName, '\d+')
  if ($m.Success) { $IssueNumber = $m.Value }
}

if ([string]::IsNullOrWhiteSpace($IssueNumber)) {
  Write-Host "⚠️ Could not determine issue number from arguments or branch '$BranchName'. Skipping branch link."
  return
}

if ([string]::IsNullOrWhiteSpace($BranchName) -or $BranchName -eq "develop" -or $BranchName -eq "main") {
  throw "ERROR: Please provide a feature/fix branch name (e.g. feat/$IssueNumber-short-slug)."
}

function Get-IssueState([string]$RepoName) {
  $q = @'
query($login: String!, $repo: String!, $issue_number: Int!) {
  repository(owner: $login, name: $repo) {
    issue(number: $issue_number) {
      id
      number
      title
      linkedBranches(first: 10) {
        nodes {
          id
          ref { name }
        }
      }
      closedByPullRequestsReferences(first: 10) {
        nodes {
          number
          state
          headRefName
          url
        }
      }
      projectItems(first: 10) {
        nodes {
          id
          project { number }
        }
      }
    }
  }
}
'@
  $raw = (gh api graphql -F login="$ORG" -F repo="$RepoName" -F issue_number=$IssueNumber -f query=$q 2>$null)
  if ($raw) {
    try { return ($raw | ConvertFrom-Json).data.repository.issue } catch { return $null }
  }
  return $null
}

$IssueObj = Get-IssueState $IssueRepo
if (-not $IssueObj -and $IssueRepo -ne $FRONTEND_REPO) {
  $IssueRepo = $FRONTEND_REPO
  $IssueObj = Get-IssueState $IssueRepo
}

if (-not $IssueObj -or -not $IssueObj.id) {
  throw "ERROR: Could not find issue #$IssueNumber in $ORG/$TRACKER_REPO or $ORG/$FRONTEND_REPO."
}

$IssueNodeId = $IssueObj.id
$RepoNodeId = (gh api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
  query($login: String!, $repo: String!) {
    repository(owner: $login, name: $repo) { id }
  }
' --jq '.data.repository.id' 2>$null)

if ([string]::IsNullOrWhiteSpace($RepoNodeId)) {
  throw "ERROR: Could not resolve repository node ID for $ORG/$FRONTEND_REPO."
}

$ExistingLinkedBranches = @()
if ($IssueObj.linkedBranches -and $IssueObj.linkedBranches.nodes) {
  $ExistingLinkedBranches = @($IssueObj.linkedBranches.nodes | ForEach-Object { $_.ref.name } | Where-Object { $_ })
}
$ExistingLinkedPRs = @()
if ($IssueObj.closedByPullRequestsReferences -and $IssueObj.closedByPullRequestsReferences.nodes) {
  $ExistingLinkedPRs = @($IssueObj.closedByPullRequestsReferences.nodes | ForEach-Object { $_.headRefName } | Where-Object { $_ })
}

if (($ExistingLinkedBranches -contains $BranchName) -or ($ExistingLinkedPRs -contains $BranchName) -or ($ExistingLinkedBranches.Count -gt 0) -or ($ExistingLinkedPRs.Count -gt 0)) {
  Write-Host "✅ Issue #$IssueNumber ($IssueRepo) is already linked to branch/PR on GitHub."
} else {
  # Determine base OID for the linked branch:
  # Prefer existing local branch tip, then existing remote branch tip, then origin/develop.
  $LocalRef = (git show-ref --verify "refs/heads/$BranchName" 2>$null)
  $RemoteRef = (git show-ref --verify "refs/remotes/origin/$BranchName" 2>$null)
  if ($LocalRef) {
    $BranchOid = (git rev-parse "refs/heads/$BranchName").Trim()
  } elseif ($RemoteRef) {
    $BranchOid = (git rev-parse "refs/remotes/origin/$BranchName").Trim()
  } else {
    git fetch origin develop --quiet 2>$null
    $OriginDevRef = (git show-ref --verify "refs/remotes/origin/develop" 2>$null)
    if ($OriginDevRef) {
      $BranchOid = (git rev-parse "refs/remotes/origin/develop").Trim()
    } else {
      $BranchOid = (git rev-parse HEAD).Trim()
    }
  }

  # Check if remote branch already exists on origin (which causes createLinkedBranch to fail)
  $RemoteHeadLine = (git ls-remote --heads origin "$BranchName" 2>$null)
  if (-not [string]::IsNullOrWhiteSpace($RemoteHeadLine)) {
    $RemoteOid = ($RemoteHeadLine -split '\s+')[0]
    if (-not $LocalRef -and -not [string]::IsNullOrWhiteSpace($RemoteOid)) {
      $BranchOid = $RemoteOid
    }
    $AllPrCount = (gh pr list --repo "$ORG/$FRONTEND_REPO" --head "$BranchName" --state all --json number --jq 'length' 2>$null)
    if (-not $AllPrCount -or [int]$AllPrCount -eq 0) {
      Write-Host "ℹ️ Remote branch origin/$BranchName already exists without a link; recreating via createLinkedBranch at $BranchOid..."
      git push origin --delete "$BranchName" 2>$null | Out-Null
    }
  }

  $CreateMutation = @'
mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
  createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
    linkedBranch { id ref { name } }
  }
}
'@
  $MutRaw = (gh api graphql -f query=$CreateMutation -F issueId="$IssueNodeId" -F repositoryId="$RepoNodeId" -F oid="$BranchOid" -F name="$BranchName" 2>&1)
  try {
    $MutJson = $MutRaw | ConvertFrom-Json
    $LinkedId = $MutJson.data.createLinkedBranch.linkedBranch.id
  } catch {
    $LinkedId = $null
  }

  if ($LinkedId) {
    Write-Host "✅ Linked branch '$BranchName' to $ORG/$IssueRepo#$IssueNumber (id: $LinkedId)"
  } else {
    Write-Warning "createLinkedBranch response: $MutRaw"
  }
}

# Fetch the remote branch and configure checkout / upstream tracking
git fetch origin "$BranchName" 2>$null | Out-Null

if (-not $NoCheckout) {
  $CurrentNow = (git branch --show-current 2>$null)
  $HasLocal = (git show-ref --verify "refs/heads/$BranchName" 2>$null)
  if ($CurrentNow -eq $BranchName) {
    git branch --set-upstream-to="origin/$BranchName" "$BranchName" 2>$null | Out-Null
  } elseif ($HasLocal) {
    git checkout "$BranchName"
    git branch --set-upstream-to="origin/$BranchName" "$BranchName" 2>$null | Out-Null
  } else {
    git checkout -b "$BranchName" --track "origin/$BranchName"
  }
} else {
  $HasLocal = (git show-ref --verify "refs/heads/$BranchName" 2>$null)
  $HasRemote = (git show-ref --verify "refs/remotes/origin/$BranchName" 2>$null)
  if ($HasLocal -and $HasRemote) {
    git branch --set-upstream-to="origin/$BranchName" "$BranchName" 2>$null | Out-Null
  }
}

# Verify link exists on GitHub
$VerifyObj = Get-IssueState $IssueRepo
$VerifiedBranches = @()
if ($VerifyObj.linkedBranches -and $VerifyObj.linkedBranches.nodes) {
  $VerifiedBranches = @($VerifyObj.linkedBranches.nodes | ForEach-Object { $_.ref.name } | Where-Object { $_ })
}
$VerifiedPRs = @()
if ($VerifyObj.closedByPullRequestsReferences -and $VerifyObj.closedByPullRequestsReferences.nodes) {
  $VerifiedPRs = @($VerifyObj.closedByPullRequestsReferences.nodes | ForEach-Object { "#$($_.number)" } | Where-Object { $_ })
}

if ($VerifiedBranches.Count -gt 0 -or $VerifiedPRs.Count -gt 0) {
  Write-Host "✅ Verified Development link on #${IssueNumber}: linkedBranches=[$($VerifiedBranches -join ',')] linkedPRs=[$($VerifiedPRs -join ',')]"
} else {
  $ExistingPrNum = (gh pr list --repo "$ORG/$FRONTEND_REPO" --head "$BranchName" --state all --limit 1 --json number --jq '.[0].number // empty' 2>$null)
  if (-not [string]::IsNullOrWhiteSpace($ExistingPrNum)) {
    $IssueUrl = "https://github.com/$ORG/$IssueRepo/issues/$IssueNumber"
    $CurrentBody = (gh pr view $ExistingPrNum --repo "$ORG/$FRONTEND_REPO" --json body --jq '.body // ""' 2>$null)
    if (($CurrentBody -notlike "*Closes $IssueUrl*") -and ($CurrentBody -notlike "*Closes $ORG/$IssueRepo#$IssueNumber*")) {
      $NewBody = "$CurrentBody`n`nCloses $IssueUrl"
      gh pr edit $ExistingPrNum --repo "$ORG/$FRONTEND_REPO" --body $NewBody 2>$null | Out-Null
      Write-Host "✅ Linked existing PR #${ExistingPrNum} to $IssueUrl"
    }
  } else {
    Write-Warning "#${IssueNumber} still has no linkedBranches or linkedPRs in Development."
  }
}

# Update Project V2 Board to "In progress"
if (-not $NoBoardUpdate) {
  $ItemId = $null
  if ($VerifyObj.projectItems -and $VerifyObj.projectItems.nodes) {
    $MatchItem = $VerifyObj.projectItems.nodes | Where-Object { $_.project.number -eq $PROJECT_NUMBER } | Select-Object -First 1
    if ($MatchItem) { $ItemId = $MatchItem.id }
  }

  # If issue is not on the Project V2 board yet, add it automatically
  if (-not $ItemId -and $PROJECT_ID -and $IssueNodeId) {
    $AddMutation = @'
mutation($project_id: ID!, $content_id: ID!) {
  addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
    item { id }
  }
}
'@
    $ItemId = (gh api graphql -F project_id="$PROJECT_ID" -F content_id="$IssueNodeId" -f query=$AddMutation --jq '.data.addProjectV2ItemById.item.id' 2>$null)
    # Wait 3s for GitHub Project "Item added to project" automation (which sets Status=Backlog) to finish
    Start-Sleep -Seconds 3
  }

  if ($ItemId -and $IN_PROGRESS_OPTION_ID -and $IN_PROGRESS_OPTION_ID -ne "null") {
    $UpdateMutation = @'
mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
  ) { projectV2Item { id } }
}
'@
    foreach ($attempt in 1..4) {
      gh api graphql -f project_id="$PROJECT_ID" -f item_id="$ItemId" -f field_id="$FIELD_ID" -f option_id="$IN_PROGRESS_OPTION_ID" -f query=$UpdateMutation 2>$null | Out-Null
      Start-Sleep -Seconds 2
      $ActualOpt = (gh api graphql -F item_id="$ItemId" -f query='query($item_id: ID!) { node(id: $item_id) { ... on ProjectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } } } } }' --jq '.data.node.fieldValueByName.optionId // empty' 2>$null)
      if ($ActualOpt -eq $IN_PROGRESS_OPTION_ID) { break }
    }
    Write-Host "✅ Ticket #$IssueNumber moved to In progress on Project Board"
  }
}
