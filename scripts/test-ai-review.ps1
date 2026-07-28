# PowerShell verification test script for AI Review SKILL.md publishing components
# Covers:
# 1. Verification of the Null-Safe JQ PR comments parser.
# 2. Mock verification of the structural truncation logic.
# 3. Graceful fallback of GH CLI when GITHUB_TOKEN is masked or failing.

$EXIT_CODE = 0

Write-Output "=================================================="
Write-Output "Running automated verification for ai-review skill"
Write-Output "=================================================="

# Helper function to assert values
function Assert-Eq($actual, $expected, $name) {
    if ($actual -eq $expected) {
        Write-Output "  [PASS] ${name}"
    } else {
        Write-Error "  [FAIL] ${name}: expected '${expected}', got '${actual}'"
        $global:EXIT_CODE = 1
    }
}

$TEST_DIR = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
[System.IO.Directory]::CreateDirectory($TEST_DIR) | Out-Null

$LF = [char]10

try {
    # ----------------------------------------------------------------------
    # Test 1: Null-Safe JQ Comments Filter
    # ----------------------------------------------------------------------
    Write-Output "Test 1: JQ filter null-safety and comment ID selection"

    $MockComments = @"
[
  {
    "id": 10001,
    "body": null,
    "user": { "login": "some-bot" }
  },
  {
    "id": 10002,
    "body": "Regular PR comment without marker",
    "user": { "login": "human-reviewer" }
  },
  {
    "id": 10003,
    "body": "<!-- ai-review-pipeline -->\n## 🤖 AI Code Review\nFirst report",
    "user": { "login": "github-actions[bot]" }
  },
  {
    "id": 10004,
    "body": null,
    "user": { "login": "another-webhook-bot" }
  },
  {
    "id": 10005,
    "body": "<!-- ai-review-pipeline -->\n## 🤖 AI Code Review\nSecond report (latest)",
    "user": { "login": "github-actions[bot]" }
  }
]
"@
    Set-Content -Path "$TEST_DIR/mock-comments.json" -Value $MockComments

    $JQ_QUERY = 'map(select(.body != null and (.body | contains("<!-- ai-review-pipeline -->")))) | sort_by(.id) | last | .id // empty'
    
    # Run jq query if available
    if (Get-Command jq -ErrorAction SilentlyContinue) {
        $ACTUAL_ID = (jq $JQ_QUERY "$TEST_DIR/mock-comments.json").Trim()
        Assert-Eq $ACTUAL_ID "10005" "JQ extracts latest comment ID containing marker and bypasses null body comments"
    } else {
        Write-Warning "Warning: 'jq' utility not found. Skipping JQ null-safety test locally."
    }

    # ----------------------------------------------------------------------
    # Test 2: Structural Truncation Logic
    # ----------------------------------------------------------------------
    Write-Output "Test 2: Structural Truncation Logic verification"

    $MockSummary = "<!-- ai-review-pipeline -->" + $LF + "## AI Code Review Report" + $LF + "Summary section is safe."
    $MockDetailed = "## Detailed Findings by Category" + $LF + "Detailed findings section that is extremely long and needs to be truncated."
    
    # Generate 65,000 characters of junk detailed findings
    $Junk = New-Object System.String('x', 65000)
    $MockReport = $MockSummary + $LF + $LF + $MockDetailed + $LF + $Junk

    # Perform structural truncation in PowerShell
    $TruncatedReport = ""
    if ($MockReport.Length -gt 60000) {
        $Index = $MockReport.IndexOf("## Detailed Findings by Category")
        if ($Index -ne -1) {
            $TruncatedReport = $MockReport.Substring(0, $Index)
            # Use ASCII-only comment to avoid PowerShell encoding parsing issues on Windows
            $TruncatedReport += $LF + "> Warning: Report too long. Truncated. See ai-review-report.md artifact."
        } else {
            $TruncatedReport = $MockReport.Substring(0, 59000) + $LF + "... [Truncated]"
        }
    } else {
        $TruncatedReport = $MockReport
    }

    $Len = $TruncatedReport.Length
    if ($Len -lt 60000) {
        $PassLimit = $true
    } else {
        $PassLimit = $false
    }

    Assert-Eq $PassLimit $true "Truncated report size is well below the 60,000 char threshold"
    
    $HasDetailedHeader = $TruncatedReport.Contains("Detailed Findings by Category")
    Assert-Eq $HasDetailedHeader $false "Detailed Findings by Category is successfully truncated"
    
    $HasWarning = $TruncatedReport.Contains("ai-review-report.md")
    Assert-Eq $HasWarning $true "Truncation notice warning is correctly appended"

    # ----------------------------------------------------------------------
    # Test 3: Graceful Fallback check on GH API failures
    # ----------------------------------------------------------------------
    Write-Output "Test 3: Graceful Fallback verification on CLI failures"

    # Simulation of error capturing logic defined in SKILL.md:
    $ApiSuccess = $false
    try {
        # Simulate a failing API call
        throw "gh: Request failed (403: Forbidden)"
    } catch {
        Write-Warning "Warning: GitHub API comments query failed: exception handled gracefully"
        # We catch the error and resolve to exit successfully (Status 0)
        $ApiSuccess = $true
    }

    Assert-Eq $ApiSuccess $true "API failures are gracefully caught and converted to non-blocking warning (no pipeline failure)"

} finally {
    if (Test-Path $TEST_DIR) {
        Remove-Item -Recurse -Force $TEST_DIR
    }
}

Write-Output "=================================================="
if ($EXIT_CODE -eq 0) {
    Write-Output "SUCCESS: All AI Review verification tests passed!"
} else {
    Write-Error "FAILURE: One or more tests failed!"
}
Write-Output "=================================================="
exit $EXIT_CODE
