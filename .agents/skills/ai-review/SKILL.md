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
     - **Summary & Merge Recommendation**: Provide a high-level summary and an overall risk level (e.g. `low`, `medium`, `high`) with logical reasoning.
     - **Requirement Coverage**: Detail how well the ticket requirements are met.
     - **Review Guide / Reading Order**: Suggest an optimal sequence of files for human reviewers to examine.
     - **Detailed Findings by Category**: Display organized feedback from each sub-agent (Security, Correctness, Business Logic, Performance, Testing, Architecture) with specific file paths, code blocks, severity, and actionable suggestions.
   - Always prefix/embed the marker `<!-- ai-review-pipeline -->` at the top of the generated markdown content so that the comment can be identified later.

4. **Publish Combined Comment**:
   - Detect if running inside a Pull Request environment or if the `GITHUB_ACTIONS` environment variable is set. You can check if the current branch has an open pull request by running:
     ```bash
     gh pr view --json number
     ```
   - **Local Dry-Run / Graceful Fallback**: If NOT running in GitHub Actions, if there is no open pull request, or if GitHub API commands fail (due to missing tokens), do NOT throw an error or fail the run. Instead, output the final aggregated review markdown to a local file named `ai-review-report.md` in the workspace root, output a summary to stdout, and complete successfully.
   - If a Pull Request number is found in a CI environment:
     - Fetch existing comments using GH CLI or the GitHub API to check if a review comment carrying the `<!-- ai-review-pipeline -->` marker has already been posted:
       ```bash
       gh api repos/{owner}/{repo}/issues/{pr-number}/comments --jq '.[] | select(.body | contains("<!-- ai-review-pipeline -->")) | .id'
       ```
     - If an existing comment ID is found:
       - Update the existing comment via GH API PATCH to prevent comment spamming:
         ```bash
         gh api -X PATCH repos/{owner}/{repo}/issues/comments/{comment_id} -F body=@<comment_file>
         ```
     - If no existing comment is found:
       - Post a new comment to the PR:
         ```bash
         gh pr comment <pr-number> --body-file <comment_file>
         ```
