#!/usr/bin/env bash
# Quietly waits for GitHub Actions PR checks (including AI Review: Final Summary)
# to complete without flooding the AI agent's context window with repeated
# polling tables. Once finished, prints a compact summary (< 30 lines) showing
# whether the PR converged or the exact findings/failures that need fixing.
#
# Usage:
#   bash .agents/scripts/wait-pr-checks.sh [<pr-number-or-url>]

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-config.sh" 2>/dev/null || true

ORG="${ORG:-Xchange-Taiwan}"
FRONTEND_REPO="${FRONTEND_REPO:-X-Talent-Frontend}"

PR_ARG="${1:-}"
if [ -n "$PR_ARG" ]; then
  PR_NUMBER=$(gh pr view "$PR_ARG" --repo "$ORG/$FRONTEND_REPO" --json number --jq '.number' 2>/dev/null || true)
else
  PR_NUMBER=$(gh pr view --repo "$ORG/$FRONTEND_REPO" --json number --jq '.number' 2>/dev/null || true)
fi

if [ -z "$PR_NUMBER" ]; then
  echo "ERROR: Could not resolve open PR number. Run /submit-pr first." >&2
  exit 1
fi

# Poll quietly every 15 seconds (up to 15 minutes = 60 polls) without printing intermediate tables
for ((i = 1; i <= 60; i++)); do
  PR_JSON=$(gh pr view "$PR_NUMBER" --repo "$ORG/$FRONTEND_REPO" --json headRefName,state,mergeable,statusCheckRollup 2>/dev/null || true)
  if [ -z "$PR_JSON" ]; then
    sleep 15
    continue
  fi

  STATUS_SUMMARY=$(echo "$PR_JSON" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        const checks = j.statusCheckRollup || [];
        if (checks.length === 0) { console.log("PENDING:0:0:0"); return; }
        let pending = 0, failed = 0, passed = 0;
        let hasFinalSummary = false;
        for (const c of checks) {
          const name = c.name || c.context || "";
          const state = c.status || c.state || "";
          const conc = c.conclusion || "";
          if (name.includes("AI Review: Final Summary") && (conc === "SUCCESS" || conc === "NEUTRAL" || conc === "SKIPPED")) {
            hasFinalSummary = true;
          }
          if (state === "IN_PROGRESS" || state === "QUEUED" || state === "PENDING" || (!conc && state !== "SUCCESS")) {
            pending++;
          } else if (conc === "SUCCESS" || conc === "NEUTRAL" || conc === "SKIPPED" || state === "SUCCESS") {
            passed++;
          } else {
            failed++;
          }
        }
        if (pending === 0 && (hasFinalSummary || checks.length >= 5)) {
          console.log(`DONE:${passed}:${failed}:${checks.length}`);
        } else {
          console.log(`PENDING:${passed}:${failed}:${pending}`);
        }
      } catch {
        console.log("PENDING:0:0:0");
      }
    });
  ')

  if [[ "$STATUS_SUMMARY" == DONE:* ]]; then
    break
  fi
  sleep 15
done

# Extract compact final check results and AI review bot comment
COMMENTS_JSON=$(gh pr view "$PR_NUMBER" --repo "$ORG/$FRONTEND_REPO" --json comments 2>/dev/null || echo '{"comments":[]}')

node -e '
  const pr = JSON.parse(process.argv[1] || "{}");
  const commentsObj = JSON.parse(process.argv[2] || "{\"comments\":[]}");
  const checks = pr.statusCheckRollup || [];

  const failedChecks = [];
  for (const c of checks) {
    const name = c.name || c.context || "unknown";
    const conc = c.conclusion || c.state || "";
    if (conc && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(conc)) {
      failedChecks.push(`${name} (${conc})`);
    }
  }

  const aiComment = [...(commentsObj.comments || [])]
    .reverse()
    .find(c =>
      (c.author?.login === "github-actions" || c.author?.login === "github-actions[bot]") &&
      (c.body || "").includes("<!-- ai-review-pipeline -->")
    );

  let riskLevel = "unknown";
  let findingsExcerpt = "";
  if (aiComment && aiComment.body) {
    const body = aiComment.body;
    const riskMatch = body.match(/### ⚠️ Overall Risk\s+\*\*([a-zA-Z]+)\*\*/i);
    if (riskMatch) riskLevel = riskMatch[1].toLowerCase();
    if (riskLevel !== "low") {
      findingsExcerpt = body.slice(0, 3500);
    }
  }

  console.log(`=== PR #${process.argv[3]} CI & AI REVIEW SUMMARY ===`);
  console.log(`Total checks: ${checks.length} | Failed: ${failedChecks.length} | AI Review Overall Risk: ${riskLevel}`);
  if (failedChecks.length > 0) {
    console.log("Failed checks:\n  - " + failedChecks.join("\n  - "));
  }
  if (failedChecks.length === 0 && (riskLevel === "low" || riskLevel === "unknown")) {
    console.log("CONVERGED=true");
    console.log("✅ All CI checks passed and AI Review risk is low. No fixes needed!");
  } else {
    console.log("CONVERGED=false");
    if (findingsExcerpt) {
      console.log("\n=== AI REVIEW FINDINGS ===\n" + findingsExcerpt);
    }
  }
' "$PR_JSON" "$COMMENTS_JSON" "$PR_NUMBER"
