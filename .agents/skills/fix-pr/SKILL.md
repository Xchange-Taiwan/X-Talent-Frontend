---
name: fix-pr
description: 'Diagnose and resolve failing Pull Request (PR) pipeline checks (CI errors) and AI reviewer comments (from local `/ai-review` reports or GitHub comments) in the X-Talent-Frontend codebase.'
disable-model-invocation: true
---

Use this skill to automatically monitor, poll, and watch pipeline checks on a pull request using GitHub CLI until they pass.

## Diagnostic & Monitoring Workflow

### 1. Identify the PR Target

Determine the pull request that needs to be monitored:

- **Explicit PR Link/Number**: Use the URL or number provided by the user.
- **Current Branch PR**: If no target is specified, the skill automatically detects the active pull request for the current local git branch.

---

### 2. Automated PR Check Monitoring

To automatically monitor checks/pipelines on the target pull request until they all pass:

1. **Invoke the monitor script**:

   ```bash
   node .agents/scripts/monitor-pr.mjs [PR_LINK_OR_NUMBER]
   ```

   _If no argument is given, it automatically detects the open PR on the current local branch using GitHub CLI and the repository metadata in `docs/agents/project-config.md`._

2. **Configuration Flags** (optional):
   - `--interval <seconds>`: Set custom polling frequency (e.g., `--interval 300` for 5 minutes).
   - `--timeout <minutes>`: Set maximum total wait time (e.g., `--timeout 60` for 1 hour).

3. **Behavior**:
   - The script will poll GitHub CLI for the check statuses.
   - If any check fails, it immediately outputs the failing check names and links, then exits with code 2.
   - If checks are pending, it waits for the configured interval (default: 5 minutes) and checks again.
   - If all checks pass, it reports success and exits with code 0.

---

### 3. High-Quality Modification Standards

When modifying the codebase to resolve any failed pipeline checks or reviewer comments, you MUST maintain high-quality, idiomatic engineering standards:

1. **Align with Core Skills**:
   - Align modifications with relevant specialized skills (e.g., use `/tdd` when writing new integration tests, and `/implement` for feature structures).

2. **Adhere to Codebase Design Standards**:
   - Refer to [references/common-ci-fixes.md](references/common-ci-fixes.md) for standard, idiomatic resolutions for common violations:
     - **Mocking (Shoehorn)**: NEVER use `as any` or `@ts-ignore` to suppress errors in tests. Use `@total-typescript/shoehorn`'s `fromPartial()` or `fromAny()` helpers to preserve type safety.
     - **Depth Boundary Violations**: Ensure `src/lib/**` and `src/services/**` do not directly import UI components, React hooks, or Next.js navigation. Inject dependencies via callback parameters.
     - **Zod & Forms**: Form components must align with Zod schemas under `src/schemas/` and custom hooks under `src/hooks/use<Name>Form`.
     - **Storybook**: stories requiring authentication or router state must use the `withAppContext` decorator.

3. **Validate Fixes Specifically**:
   - Do not waste time running all local verification commands from scratch; instead, directly compile, build, or test the **specific files** related to the failure to quickly verify your changes before pushing.
