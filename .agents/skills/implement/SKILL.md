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

4. **Complete & Submit PR:**
   - Once implementation is done, verified, and reviewed, call the `/submit-pr` skill to run final tests, commit, push, create a PR, and move the ticket to `PR Review` status.

---

## General Guidelines (All Repositories)

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Please use GitHub CLI (gh cli) / 請使用 gh cli for all GitHub-related operations (such as creating/submitting PRs).
