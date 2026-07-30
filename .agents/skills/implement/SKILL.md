---
name: implement
description: 'Implement a piece of work based on a spec or set of tickets.'
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## X-Frontend Repositories Workflow

If the workspace is an `X-Frontend` project (e.g., `X-Talent-Frontend` or similar frontend repository), you MUST strictly follow this modular workflow:

1. **Setup Branch:**
   - Call the `/start-ticket <github-issue-url>` skill to automatically pull develop, create/link the branch programmatically via GraphQL, and analyze requirements.

2. **Implement Feature:**
   - Implement the requirements step-by-step. Use TDD where possible.
   - Run typechecking and tests regularly.

3. **Run AI Review Locally:**
   - Once implementation is complete, call the `/ai-review` skill to launch parallel sub-agents (Security, Correctness, Business Logic, Performance, Testing, Architecture, and Review Guide).
   - These agents will review your changes locally against the actual X-Tracker ticket requirements.
   - Address any critical issues, security warnings, or logic bugs highlighted in the review.
   - **Automated Handoff Contract**:
     - Locate the generated review report and parse the `Review Status` line.
     - **If the output contains `Review Status: PASS`**: You MUST automatically transition to **Step 4 (`/submit-pr`)** in the exact same turn without stopping, asking the user, or halting the workflow.
     - **If the output contains `Review Status: BLOCKED`** (or if the status line is missing): You should automatically trigger the `/fix-pr` guidelines to resolve the highlighted concerns (referencing `references/common-ci-fixes.md`), then re-run `/ai-review` until the status changes to `PASS`. Do not proceed to `/submit-pr` until it passes.

4. **Complete & Submit PR:**
   - Once implementation is done, verified, and reviewed, call the `/submit-pr` skill to run final tests, commit, push, create a PR, and move the ticket to `PR Review` status.

5. **Monitor & Self-Heal PR Checks (Automated Pipeline Resolution):**
   - After successfully submitting the PR, you MUST automatically run the `/fix-pr` pipeline monitor to watch the checks:
     ```bash
     node .agents/scripts/monitor-pr.mjs
     ```
   - **If the pipeline checks fail**: Parse the failing checks from the logs, apply high-quality modifications following the design standards in `/fix-pr`, push your changes, and re-run the monitor script.
   - **If all pipeline checks pass**: Congratulations, the workflow is successfully completed!

---

## General Guidelines (All Repositories)

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Please use GitHub CLI (gh cli) / 請使用 gh cli for all GitHub-related operations (such as creating/submitting PRs).
