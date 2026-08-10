# Publishes screenshot/evidence files to a dedicated orphan branch
# (default: pr-evidence) without touching the caller's working tree,
# index, or current branch. Prints one raw.githubusercontent.com URL per
# input file, in order, pinned to the commit sha that published it.
#
# Usage: .\publish-evidence.ps1 <file> [<file> ...]
# Env:   EVIDENCE_BRANCH (default: pr-evidence)

param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$Files
)

foreach ($f in $Files) {
  if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
    Write-Error "file not found: $f"
    exit 1
  }
}

$EvidenceBranch = if ($env:EVIDENCE_BRANCH) { $env:EVIDENCE_BRANCH } else { "pr-evidence" }

$RemoteUrl = (git remote get-url origin)
$RepoSlug = $RemoteUrl -replace '^git@github\.com:', '' -replace '^https://github\.com/', '' -replace '\.git$', ''
if (-not $RepoSlug) {
  Write-Error "could not resolve owner/repo from origin remote ($RemoteUrl)"
  exit 1
}

$Branch = (git branch --show-current)
if (-not $Branch) {
  Write-Error "not on a branch (detached HEAD)"
  exit 1
}
$BranchSlug = $Branch -replace '/', '-'
$Prefix = "$BranchSlug/$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"

$ParentSha = ((git ls-remote origin "refs/heads/$EvidenceBranch") -split "`t")[0]

function Invoke-Git {
  # Runs git natively (stderr stays on the console, never wrapped as a
  # PowerShell ErrorRecord) and throws on a non-zero exit code.
  & git @args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

# A fresh temp file is 0 bytes, which git's index reader rejects as
# malformed rather than treating as "no index yet" - so only reserve the
# path, then delete it immediately and let git create it on first write.
$ScratchIndex = [System.IO.Path]::GetTempFileName()
Remove-Item -LiteralPath $ScratchIndex -Force
try {
  $env:GIT_INDEX_FILE = $ScratchIndex

  if ($ParentSha) {
    Invoke-Git read-tree $ParentSha
  } else {
    $MarkerPath = [System.IO.Path]::GetTempFileName()
    @"
Evidence branch for PR screenshots, published by .agents/scripts/publish-evidence.ps1.

This is an orphan branch: it shares no history with the repository code
branches. Pull request bodies link into it by commit sha, so links stay
stable even after later runs overwrite the same paths at the branch tip.
"@ | Set-Content -LiteralPath $MarkerPath -Encoding Ascii -NoNewline
    $MarkerBlob = (Invoke-Git hash-object -w $MarkerPath)
    Remove-Item -LiteralPath $MarkerPath -Force
    Invoke-Git update-index --add --cacheinfo 100644 $MarkerBlob ".pr-evidence"
  }

  $RelPaths = @()
  $Index = 0
  foreach ($f in $Files) {
    $Blob = (Invoke-Git hash-object -w $f)
    $Filename = Split-Path -Leaf $f
    $RelPath = "$Prefix/$Index-$Filename"
    Invoke-Git update-index --add --cacheinfo 100644 $Blob $RelPath
    $RelPaths += $RelPath
    $Index++
  }

  $NewTree = (Invoke-Git write-tree)

  # Piping a string to a native command uses $OutputEncoding to convert it to
  # bytes; the default in Windows PowerShell 5.1 prepends a UTF-8 BOM, which
  # would land inside the commit message text itself.
  $OutputEncoding = New-Object System.Text.UTF8Encoding $false

  $CommitMsg = "evidence: $Branch"
  if ($ParentSha) {
    $CommitSha = ($CommitMsg | & git commit-tree $NewTree -p $ParentSha)
  } else {
    $CommitSha = ($CommitMsg | & git commit-tree $NewTree)
  }
  if ($LASTEXITCODE -ne 0) {
    throw "git commit-tree failed with exit code $LASTEXITCODE"
  }

  Invoke-Git push origin "${CommitSha}:refs/heads/$EvidenceBranch"

  foreach ($RelPath in $RelPaths) {
    Write-Output "https://raw.githubusercontent.com/$RepoSlug/$CommitSha/$RelPath"
  }
} finally {
  Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ScratchIndex -Force -ErrorAction SilentlyContinue
}
