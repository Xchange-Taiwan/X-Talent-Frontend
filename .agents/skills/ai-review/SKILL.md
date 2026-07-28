---
name: ai-review
description: 'Run the full AI review pipeline locally in parallel using concurrent sub-agents, with zero API keys required.'
disable-model-invocation: true
---

Run a complete, parallelized multi-stage AI Review locally using concurrent sub-agents without needing any external API keys.

## Usage

```
/ai-review
```

## What this does

1. **Retrieve Changes & Ticket Context**:
   - Run `git diff origin/develop` to capture all unstaged, staged, or committed changes on the current branch.
   - Detect the current branch name and extract the associated issue number (e.g., `feat/45-xxx` -> issue `45`).
   - If an issue number is found, automatically use GitHub CLI to fetch the full issue context (title, body, and comments) from `Xchange-Taiwan/X-Talent-Tracker` (or fallback to the current repo if needed):
     ```bash
     gh issue view <issue-number> --repo Xchange-Taiwan/X-Talent-Tracker --json title,body,comments
     ```

2. **Invoke Parallel Sub-Agents with Shared Context**:
   - Call the `invoke_agent` tool in parallel (concurrently in a single turn) to launch multiple independent `generalist` sub-agents, passing the git diff, the custom project prompts, and the **fetched Ticket requirements** to relevant agents (especially Business Logic, Correctness, and Review Guide):
     - **Sub-agent 1 (Security)**: Apply instructions from `scripts/ai-review/prompts/security.md` to review potential leaks, vulnerabilities, and insecure patterns.
     - **Sub-agent 2 (Correctness)**: Compare the code diff against the **Ticket requirements** and apply `scripts/ai-review/prompts/correctness.md` to find logic flaws or regressions.
     - **Sub-agent 3 (Business Logic)**: Compare the code diff against the **Ticket requirements** and apply `scripts/ai-review/prompts/business-logic.md` to ensure every specified business feature is correctly implemented.
     - **Sub-agent 4 (Performance)**: Apply instructions from `scripts/ai-review/prompts/performance.md`.
     - **Sub-agent 5 (Testing)**: Apply instructions from `scripts/ai-review/prompts/testing.md` to suggest test coverage matching the ticket's functionality.
     - **Sub-agent 6 (Architecture)**: Apply instructions from `scripts/ai-review/prompts/architecture.md`.
     - **Sub-agent 7 (Review Guide)**: Apply instructions from `scripts/ai-review/prompts/review-guide.md` referencing the original ticket goals.

3. **Aggregate & Generate Final Summary**:
   - Once all parallel sub-agents return their findings, read the custom summary prompt in `scripts/ai-review/prompts/summary.md`.
   - Aggregate all the sub-agent outputs and compile the final review comment.
