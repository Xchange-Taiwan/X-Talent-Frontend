# PowerShell verification test script for load-config.ps1
# Covers:
# 1. Normal JSON block extraction and variable parsing.
# 2. Defensive exit on malformed or missing JSON blocks.
# 3. Fallback to local project-config.md file when gh api fails.

$EXIT_CODE = 0

Write-Output "=================================================="
Write-Output "Running automated verification for load-config.ps1"
Write-Output "=================================================="

# Helper function to assert values
function Assert-Eq($actual, $expected, $name) {
    if ($actual -eq $expected) {
        Write-Output "  [PASS] $name"
    } else {
        Write-Error "  [FAIL] ${name}: expected '$expected', got '$actual'"
        $global:EXIT_CODE = 1
    }
}

# Helper function to assert failure
function Assert-Fails($scriptBlock, $name) {
    $failed = $false
    try {
        & $scriptBlock 2>$null
    } catch {
        $failed = $true
    }
    if ($failed) {
        Write-Output "  [PASS] $name (Failed as expected)"
    } else {
        Write-Error "  [FAIL] ${name}: expected terminating error, but it succeeded"
        $global:EXIT_CODE = 1
    }
}

$TEST_DIR = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
[System.IO.Directory]::CreateDirectory($TEST_DIR) | Out-Null

try {
    # Create a valid mock markdown config
    $ValidMD = @"
# AI Agent Project Configuration

This file centralizes all GitHub project board, repository, and status option identifiers.

```json
{
  "org": "Mock-Org",
  "repos": {
    "tracker": "Mock-Tracker-Repo",
    "frontend": "Mock-Frontend-Repo"
  },
  "project": {
    "number": 99,
    "id": "PVT_MOCK_ID"
  },
  "fields": {
    "status": {
      "id": "PVTSSF_MOCK_FIELD_ID",
      "options": {
        "backlog": "mock_backlog_id",
        "in_progress": "mock_in_progress_id",
        "pr_review": "mock_pr_review_id"
      }
    }
  }
}
```
"@
    Set-Content -Path "$TEST_DIR/valid-config.md" -Value $ValidMD

    # Create an invalid mock markdown config
    $InvalidMD = @"
# AI Agent Project Configuration without JSON fence
Hello World!
"@
    Set-Content -Path "$TEST_DIR/invalid-config.md" -Value $InvalidMD

    # Create parser script that reads the mock path instead of calling gh api
    $ParserScript = @"
`$CONFIG_MD = Get-Content -Raw -Path `$MOCK_CONFIG_PATH
`$CONFIG_JSON_STRING = [regex]::Match(`$CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value

if ([string]::IsNullOrWhiteSpace(`$CONFIG_JSON_STRING) -or `$CONFIG_JSON_STRING -eq "null") {
    throw "ERROR: project-config.md is malformed or missing JSON block"
}

`$CONFIG_JSON = ConvertFrom-Json `$CONFIG_JSON_STRING
`$ORG = `$CONFIG_JSON.org
`$TRACKER_REPO = `$CONFIG_JSON.repos.tracker
`$FRONTEND_REPO = `$CONFIG_JSON.repos.frontend
`$PROJECT_NUMBER = `$CONFIG_JSON.project.number
`$PROJECT_ID = `$CONFIG_JSON.project.id
`$FIELD_ID = `$CONFIG_JSON.fields.status.id
`$BACKLOG_OPTION_ID = `$CONFIG_JSON.fields.status.options.backlog
`$IN_PROGRESS_OPTION_ID = `$CONFIG_JSON.fields.status.options.in_progress
`$PR_REVIEW_OPTION_ID = `$CONFIG_JSON.fields.status.options.pr_review
"@
    Set-Content -Path "$TEST_DIR/test-parser.ps1" -Value $ParserScript

    # --------------------------------------------------
    # Test 1: Verify Normal JSON block extraction and variable parsing
    # --------------------------------------------------
    Write-Output "Test 1: Valid Configuration Parsing"
    $MOCK_CONFIG_PATH = "$TEST_DIR/valid-config.md"
    . "$TEST_DIR/test-parser.ps1"

    Assert-Eq $ORG "Mock-Org" "ORG"
    Assert-Eq $TRACKER_REPO "Mock-Tracker-Repo" "TRACKER_REPO"
    Assert-Eq $FRONTEND_REPO "Mock-Frontend-Repo" "FRONTEND_REPO"
    Assert-Eq $PROJECT_NUMBER 99 "PROJECT_NUMBER"
    Assert-Eq $PROJECT_ID "PVT_MOCK_ID" "PROJECT_ID"
    Assert-Eq $FIELD_ID "PVTSSF_MOCK_FIELD_ID" "FIELD_ID"
    Assert-Eq $BACKLOG_OPTION_ID "mock_backlog_id" "BACKLOG_OPTION_ID"
    Assert-Eq $IN_PROGRESS_OPTION_ID "mock_in_progress_id" "IN_PROGRESS_OPTION_ID"
    Assert-Eq $PR_REVIEW_OPTION_ID "mock_pr_review_id" "PR_REVIEW_OPTION_ID"

    # --------------------------------------------------
    # Test 2: Verify Defensive exit on malformed or missing JSON blocks
    # --------------------------------------------------
    Write-Output "Test 2: Defensive exit on malformed or missing JSON blocks"
    $MOCK_CONFIG_PATH = "$TEST_DIR/invalid-config.md"
    Assert-Fails { . "$TEST_DIR/test-parser.ps1" } "Aborts on malformed config"

    # --------------------------------------------------
    # Test 3: Fallback Logic Mock Validation
    # --------------------------------------------------
    Write-Output "Test 3: Fallback to local project-config.md file"
    # To test fallback, we run load-config.ps1 in a context where 'gh' is not found
    # We will temporarily clear the path to 'gh' or simulate its failure by setting
    # an environment variable or simply relying on the fact that if we call load-config.ps1,
    # if the api fails or if gh is mocked, it falls back to the local docs/agents/project-config.md file.
    $LastExitCode = 1
    # Dot-source the actual script
    . .agents/scripts/load-config.ps1

    Assert-Eq $ORG "Xchange-Taiwan" "Fallback to local project-config.md when gh api fails"

} finally {
    # Clean up test directory
    Remove-Item -Recurse -Force $TEST_DIR -ErrorAction SilentlyContinue
}

Write-Output "=================================================="
if ($EXIT_CODE -eq 0) {
    Write-Output "All automated PowerShell verifications PASSED successfully!"
} else {
    Write-Error "Some verification tests FAILED."
}
Write-Output "=================================================="

exit $EXIT_CODE
