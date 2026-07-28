# Fetch config file from tracker repository (using main branch)
$CONFIG_MD = (gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>$null)

# Fallback to local file if fetch failed (checks exit status or empty variable)
if ($LastExitCode -ne 0 -or -not $CONFIG_MD) {
  if (Test-Path "docs/agents/project-config.md") {
    $CONFIG_MD = (Get-Content -Raw -Path "docs/agents/project-config.md")
  } else {
    $CONFIG_MD = $null
  }
}

# Check if config content is present
if (-not $CONFIG_MD) {
  throw "ERROR: project-config.md not found — aborting to avoid null ID API calls"
}

# Extract and parse JSON
$CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value

# Validate extracted JSON content
if ([string]::IsNullOrWhiteSpace($CONFIG_JSON_STRING) -or $CONFIG_JSON_STRING -eq "null") {
  throw "ERROR: project-config.md is malformed or missing JSON block — aborting"
}

$CONFIG_JSON = ConvertFrom-Json $CONFIG_JSON_STRING
$ORG = $CONFIG_JSON.org
$TRACKER_REPO = $CONFIG_JSON.repos.tracker
$FRONTEND_REPO = $CONFIG_JSON.repos.frontend
$PROJECT_NUMBER = $CONFIG_JSON.project.number
$PROJECT_ID = $CONFIG_JSON.project.id
$FIELD_ID = $CONFIG_JSON.fields.status.id
$BACKLOG_OPTION_ID = $CONFIG_JSON.fields.status.options.backlog
$IN_PROGRESS_OPTION_ID = $CONFIG_JSON.fields.status.options.in_progress
$PR_REVIEW_OPTION_ID = $CONFIG_JSON.fields.status.options.pr_review

# Set variables in global scope to ensure they persist when dot-sourced
$global:ORG = $ORG
$global:TRACKER_REPO = $TRACKER_REPO
$global:FRONTEND_REPO = $FRONTEND_REPO
$global:PROJECT_NUMBER = $PROJECT_NUMBER
$global:PROJECT_ID = $PROJECT_ID
$global:FIELD_ID = $FIELD_ID
$global:BACKLOG_OPTION_ID = $BACKLOG_OPTION_ID
$global:IN_PROGRESS_OPTION_ID = $IN_PROGRESS_OPTION_ID
$global:PR_REVIEW_OPTION_ID = $PR_REVIEW_OPTION_ID
