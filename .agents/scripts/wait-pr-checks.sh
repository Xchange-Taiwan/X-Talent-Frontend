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
PR_JSON=""
for ((i = 1; i <= 60; i++)); do
  LATEST_PR_JSON=$(gh pr view "$PR_NUMBER" --repo "$ORG/$FRONTEND_REPO" --json headRefName,state,mergeable,labels,statusCheckRollup 2>/dev/null || true)
  if [ -z "$LATEST_PR_JSON" ]; then
    sleep 15
    continue
  fi
  PR_JSON="$LATEST_PR_JSON"

  STATUS_SUMMARY=$(printf '%s' "$PR_JSON" | node -e '
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
          const typename = c.__typename || (c.context && !c.status ? "StatusContext" : "CheckRun");
          const status = String(c.status || "").toUpperCase();
          const state = String(c.state || "").toUpperCase();
          const conc = String(c.conclusion || "").toUpperCase();
          if (name.includes("AI Review: Final Summary") && (conc === "SUCCESS" || conc === "NEUTRAL" || conc === "SKIPPED")) {
            hasFinalSummary = true;
          }
          const isPending = typename === "StatusContext"
            ? (state === "PENDING" || state === "EXPECTED")
            : (status !== "COMPLETED");
          if (isPending) {
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

# Extract compact final check results and AI review bot comment via temp files (avoids Linux 128KB MAX_ARG_STRLEN E2BIG)
TMP_PR_JSON=$(mktemp)
TMP_COMMENTS_JSON=$(mktemp)
trap 'rm -f "$TMP_PR_JSON" "$TMP_COMMENTS_JSON"' EXIT
printf '%s' "${PR_JSON:-{}}" > "$TMP_PR_JSON"
gh pr view "$PR_NUMBER" --repo "$ORG/$FRONTEND_REPO" --json comments > "$TMP_COMMENTS_JSON" 2>/dev/null || printf '{"comments":[]}' > "$TMP_COMMENTS_JSON"

node --input-type=commonjs - "$TMP_PR_JSON" "$TMP_COMMENTS_JSON" "$PR_NUMBER" <<'EOF'
const fs = require("fs");
const [prFile, commentsFile, prNum] = process.argv.slice(2);
let pr = {};
let commentsObj = { comments: [] };
try { pr = JSON.parse(fs.readFileSync(prFile, "utf8") || "{}"); } catch {}
try { commentsObj = JSON.parse(fs.readFileSync(commentsFile, "utf8") || '{"comments":[]}'); } catch {}

const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : [];
const labels = Array.isArray(pr.labels) ? pr.labels.map(l => String(l?.name || "")) : [];
const comments = Array.isArray(commentsObj.comments) ? commentsObj.comments : [];

const vercelQuotaReached =
  labels.includes("vercel-quota-limit") ||
  comments.some(c => /vercel-quota-limit|api-deployments-free-per-day|Resource is limited - try again in/i.test(String(c?.body || ""))) ||
  checks.some(c => /vercel/i.test(String(c?.name || c?.context || "")) && /api-deployments-free-per-day|Resource is limited/i.test(String(c?.description || c?.title || "")));

const failedChecks = [];
for (const c of checks) {
  const name = c.name || c.context || "unknown";
  const typename = c.__typename || (c.context && !c.status ? "StatusContext" : "CheckRun");
  const status = String(c.status || "").toUpperCase();
  const state = String(c.state || "").toUpperCase();
  const conc = String(c.conclusion || "").toUpperCase();
  const isCompleted = typename === "StatusContext"
    ? (state !== "PENDING" && state !== "EXPECTED" && Boolean(state))
    : (status === "COMPLETED");
  const effectiveResult = typename === "StatusContext" ? state : conc;
  if (!isCompleted) {
    if (vercelQuotaReached && /vercel|deploy pr preview/i.test(name)) {
      continue;
    }
    failedChecks.push(`${name} (${status || state || "PENDING"})`);
  } else if (!["SUCCESS", "NEUTRAL", "SKIPPED"].includes(effectiveResult)) {
    if (vercelQuotaReached && /vercel|deploy pr preview/i.test(name)) {
      continue;
    }
    failedChecks.push(`${name} (${effectiveResult || "FAILED"})`);
  }
}

const aiComment = [...comments]
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

const mergeable = String(pr.mergeable || "");
if (mergeable === "CONFLICTING") {
  failedChecks.push("Merge Conflict against base branch (CONFLICTING)");
}

console.log(`=== PR #${prNum} CI & AI REVIEW SUMMARY ===`);
console.log(`Total checks: ${checks.length} | Mergeable: ${mergeable || "UNKNOWN"} | Failed: ${failedChecks.length} | AI Review Overall Risk: ${riskLevel} | VercelQuotaLimit: ${vercelQuotaReached}`);
if (vercelQuotaReached) {
  console.log("VERCEL_LIMIT=true");
}
if (failedChecks.length > 0) {
  console.log("Failed checks:\n  - " + failedChecks.join("\n  - "));
}
if (checks.length > 0 && failedChecks.length === 0 && riskLevel === "low") {
  console.log("CONVERGED=true");
  console.log("✅ All CI checks passed and AI Review risk is low. No fixes needed!");
} else {
  console.log("CONVERGED=false");
  if (findingsExcerpt) {
    console.log("\n=== AI REVIEW FINDINGS ===\n" + findingsExcerpt);
  }
}
EOF
