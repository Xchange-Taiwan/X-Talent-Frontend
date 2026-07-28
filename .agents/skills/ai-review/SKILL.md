---
name: ai-review
description: 'Run the full AI review pipeline locally in parallel using concurrent sub-agents, with zero API keys required.'
disable-model-invocation: true
---

# Parallel AI Review Pipeline

Run a complete, parallelized multi-stage AI Review locally or in CI using concurrent sub-agents without needing any external API keys.

## Usage

```bash
/ai-review
```

## What this does

1. **Retrieve Changes & Ticket Context**:
   - Run `git diff origin/develop` to capture all unstaged, staged, or committed changes on the current branch. (If `origin/develop` is not available, fallback to `git diff main` or `git diff HEAD~1`).
   - Detect the current branch name and extract the associated issue/ticket number (e.g., `feat/45-xxx` -> issue `45`).
   - If an issue number is found, automatically use GitHub CLI to fetch the full issue context (title, body, and comments) from `Xchange-Taiwan/X-Talent-Tracker`:
     ```bash
     gh issue view <issue-number> --repo Xchange-Taiwan/X-Talent-Tracker --json title,body,comments
     ```
     _(If this command fails due to token permissions or offline/local mode, gracefully fallback and continue the review using the branch name and git diff only)._

2. **Invoke Parallel Sub-Agents with Shared Context**:
   - Call the `invoke_agent` tool in parallel (concurrently in a single turn) to launch multiple independent `generalist` sub-agents, passing the git diff, the custom project prompts, and the **fetched Ticket requirements** to the following specialized agents:
     - **Sub-agent 1 (Security)**: Apply instructions from `scripts/ai-review/prompts/security.md` to review potential leaks, vulnerabilities, and insecure patterns.
     - **Sub-agent 2 (Correctness)**: Compare the code diff against the **Ticket requirements** and apply `scripts/ai-review/prompts/correctness.md` to find logic flaws or regressions.
     - **Sub-agent 3 (Business Logic)**: Compare the code diff against the **Ticket requirements** and apply `scripts/ai-review/prompts/business-logic.md` to ensure every specified business feature is correctly implemented.
     - **Sub-agent 4 (Performance)**: Apply instructions from `scripts/ai-review/prompts/performance.md`.
     - **Sub-agent 5 (Testing)**: Apply instructions from `scripts/ai-review/prompts/testing.md` to suggest test coverage matching the ticket's functionality.
     - **Sub-agent 6 (Architecture)**: Apply instructions from `scripts/ai-review/prompts/architecture.md`.
     - **Sub-agent 7 (Review Guide)**: Apply instructions from `scripts/ai-review/prompts/review-guide.md` referencing the original ticket goals.

3. **Aggregate & Generate Final Summary**:
   - Once all parallel sub-agents return their findings, read the custom summary prompt in `scripts/ai-review/prompts/summary.md`.
   - Aggregate all the sub-agent outputs and compile the final review comment following a structured format:
     - **Title**: `## 🤖 AI Code Review Report (X-Tracker #<issue-number>)`
     - **Review Status (CRITICAL)**: Must output exactly one of the following structured status lines at the top of the summary section (right after the title) to serve as a precise contract for automated handoff in `/implement`:
       - `**Review Status: PASS**` (If NO security or logic issues with severity `Critical` or `Blocking` are found by any of the sub-agents).
       - `**Review Status: BLOCKED**` (If any sub-agent reports a `Critical` or `Blocking` severity issue).
     - **Summary & Merge Recommendation**: Provide a high-level summary and an overall risk level (e.g. `low`, `medium`, `high`) with logical reasoning.
     - **Requirement Coverage**: Detail how well the ticket requirements are met.
     - **Review Guide / Reading Order**: Suggest an optimal sequence of files for human reviewers to examine.
     - **Detailed Findings by Category**: Display organized feedback from each sub-agent (Security, Correctness, Business Logic, Performance, Testing, Architecture) with specific file paths, code blocks, severity, and actionable suggestions.
   - Always prefix/embed the marker `<!-- ai-review-pipeline -->` at the top of the generated markdown content so that the comment can be identified later.

4. **Publish Combined Comment**:
   - **Always write full report**: Always output the final, untruncated aggregated review markdown to a local file named `ai-review-report.md` in the workspace root.
   - **Determine PR Number & Environment**:
     - Check if the PR number and GitHub Actions environment are explicitly provided in the user prompt (e.g., if the prompt contains "PR Number: <number>" or similar) or if the `PR_NUMBER` environment variable is defined in the environment.
     - **Note on masked tokens (`\***`)**: In GitHub Actions, secrets and tokens (such as `GITHUB\*TOKEN`) are masked as `\*\*\*`in the logs for security. This is expected and means the token is fully valid, present, and active in the process environment. Do NOT treat`\_\*\*` as a missing, invalid, or redacted token.
     - If a PR number is identified from either the prompt text or environment variables, you MUST use that PR number, assume you are in a GitHub Actions environment with a valid token, and **proceed immediately to Post/Update PR Comment**. Do NOT fall back to Dry-Run or Local Fallback under any circumstances when a PR number is present.
     - If no PR number is found in the prompt or environment variables, you can try to run `gh pr view --json number --jq .number` to detect it.
     - If no pull request number can be resolved, or if you are running locally outside GitHub Actions, complete the run as a **Local Dry-Run**: output a summary to stdout, ensure `ai-review-report.md` has the full content, and exit successfully.
   - **Handle Character Limits (Structural Truncation)**:
     - Check the character length of the generated review comment body.
     - If the length exceeds 60,000 characters, perform a **structural truncation** to prevent Markdown breakage: remove everything from the `## Detailed Findings by Category` header and onwards, and replace it with the following note (pointing to the CI artifact):
       ```markdown
       > ⚠️ 完整報告過長，已截斷。完整內容請見本次 workflow run 的 CI artifact「ai-review-report.md」。
       ```
     - Write the potentially-truncated content to a separate temporary file (e.g., `pr-comment-body.md`) to use as the payload for the API/CLI calls.
   - **Post/Update PR Comment**:
     - Use the repository specified by `GITHUB_REPOSITORY` environment variable (or fall back to `Xchange-Taiwan/X-Talent-Frontend`).
     - Query existing comments of the PR using `gh api` with robust `jq` parsing to find the latest comment containing the `<!-- ai-review-pipeline -->` marker, sorting by ID:
       ```bash
       gh api repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments --jq 'map(select(.body != null and (.body | contains("<!-- ai-review-pipeline -->")))) | sort_by(.id) | last | .id // empty'
       ```
     - If an existing comment ID is found:
       - Update (PATCH) the existing comment via GH API to prevent comment spamming:
         ```bash
         gh api -X PATCH repos/$GITHUB_REPOSITORY/issues/comments/{comment_id} -F body=@pr-comment-body.md
         ```
     - If no existing comment is found:
       - Post a new comment to the PR:
         ```bash
         gh pr comment $PR_NUMBER --body-file pr-comment-body.md
         ```
     - If any GitHub API call fails during the publishing phase, print a warning to stderr but do NOT fail the job (exit with status 0), ensuring the workflow doesn't get blocked by minor API/rate limit issues.
