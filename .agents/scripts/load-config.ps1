# Fetch config file from tracker repository (using main branch)
$CONFIG_MD = $null
try {
  $CONFIG_MD = (gh api /repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>$null)
} catch {}

# Parse JSON block from fetched content
$CONFIG_JSON_STRING = $null
if ($CONFIG_MD) {
  $CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value
}

# Fallback to local file if fetch failed, returned an error, or had no valid JSON block
$isNotFound = $CONFIG_MD -and ($CONFIG_MD -match '"message": "Not Found"')
if ($LastExitCode -ne 0 -or $isNotFound -or [string]::IsNullOrWhiteSpace($CONFIG_JSON_STRING) -or $CONFIG_JSON_STRING -eq "null") {
  if (Test-Path "docs/agents/project-config.md") {
    $CONFIG_MD = (Get-Content -Raw -Path "docs/agents/project-config.md")
    $CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value
  } else {
    $CONFIG_MD = $null
    $CONFIG_JSON_STRING = $null
  }
}

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
$READY_FOR_REVIEW_OPTION_ID = if ($CONFIG_JSON.fields.status.options.ready_for_review) { $CONFIG_JSON.fields.status.options.ready_for_review } else { "86e0fe35" }
$TODO_OPTION_ID = if ($CONFIG_JSON.fields.status.options.todo) { $CONFIG_JSON.fields.status.options.todo } else { "f75ad846" }
$IN_PROGRESS_OPTION_ID = $CONFIG_JSON.fields.status.options.in_progress
$PR_REVIEW_OPTION_ID = $CONFIG_JSON.fields.status.options.pr_review
$QA_REVIEW_OPTION_ID = if ($CONFIG_JSON.fields.status.options.qa_review) { $CONFIG_JSON.fields.status.options.qa_review } else { "8c4c8ea2" }
$DONE_OPTION_ID = if ($CONFIG_JSON.fields.status.options.done) { $CONFIG_JSON.fields.status.options.done } else { "98236657" }

# Set variables in global scope to ensure they persist when dot-sourced
# (including common aliases agents sometimes use so ad-hoc GraphQL calls never fail)
$global:ORG = $ORG
$global:GITHUB_ORG = $ORG
$global:TRACKER_ORG = $ORG
$global:TRACKER_REPO = $TRACKER_REPO
$global:FRONTEND_REPO = $FRONTEND_REPO
$global:PROJECT_NUMBER = $PROJECT_NUMBER
$global:PROJECT_ID = $PROJECT_ID
$global:FIELD_ID = $FIELD_ID
$global:STATUS_FIELD_ID = $FIELD_ID
$global:BACKLOG_OPTION_ID = $BACKLOG_OPTION_ID
$global:STATUS_BACKLOG = $BACKLOG_OPTION_ID
$global:READY_FOR_REVIEW_OPTION_ID = $READY_FOR_REVIEW_OPTION_ID
$global:STATUS_READY_FOR_REVIEW = $READY_FOR_REVIEW_OPTION_ID
$global:TODO_OPTION_ID = $TODO_OPTION_ID
$global:STATUS_TODO = $TODO_OPTION_ID
$global:IN_PROGRESS_OPTION_ID = $IN_PROGRESS_OPTION_ID
$global:STATUS_IN_PROGRESS = $IN_PROGRESS_OPTION_ID
$global:PR_REVIEW_OPTION_ID = $PR_REVIEW_OPTION_ID
$global:STATUS_PR_REVIEW = $PR_REVIEW_OPTION_ID
$global:QA_REVIEW_OPTION_ID = $QA_REVIEW_OPTION_ID
$global:STATUS_QA_REVIEW = $QA_REVIEW_OPTION_ID
$global:DONE_OPTION_ID = $DONE_OPTION_ID
$global:STATUS_DONE = $DONE_OPTION_ID
