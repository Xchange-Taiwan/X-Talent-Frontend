---
name: penpot-sync
description: "Restore a live page (or flow of pages) from the deployed dev site into an editable Penpot design draft — full layout, images, and mock user/interaction states — grounded in this codebase's design tokens and the already-synced Penpot Components library."
disable-model-invocation: true
---

Rebuild a real, running page — or a multi-page flow — as an editable Penpot design, driven by what the live dev deployment actually renders, not by guessing from source alone. Code (and the live site it produces) is always truth; the resulting Penpot draft is what gets corrected to match it.

This is the page/flow counterpart to the one-time Components-library sync — that sync already turned `src/components/ui/*` into real Penpot library components; this skill instances those components to reconstruct actual pages.

## Core rule — everything must match project style

- Colors/spacing/radius/typography come only from `src/design/tokens/` — never invent or eyeball a hex value.
- Reuse instances from the Penpot **Components** page (`component.instance()`) for anything that already exists there (Button, Input, Dialog, Select, ...). Only hand-build a board from scratch for content that has no library equivalent (page-specific copy, images, illustrations).
- If the live site itself violates CLAUDE.md's own styling rules (e.g. a hardcoded color instead of a token), don't launder that bug into the draft as if it were intentional — build that element from the _nearest correct token_ instead, and call it out as a "codebase violation" in the final report (see Step 9).
- Every run creates a **new, isolated draft page** in Penpot. Never write into the canonical `Components` page or any other existing page. The user reviews and merges manually.

## Prerequisites

- Penpot MCP connected to the target file (same MCP server used by the Components sync).
- `DESIGN_AUDIT_MENTOR_EMAIL` / `DESIGN_AUDIT_MENTOR_PASSWORD` / `DESIGN_AUDIT_MENTEE_EMAIL` / `DESIGN_AUDIT_MENTEE_PASSWORD` set (`.env.development.local`, gitignored — see `.env.example`). Real accounts on the deployed dev backend. Kept separate from `E2E_EMAIL`/`E2E_PASSWORD` (the Playwright e2e suite's own forged-session credentials) — never reuse or mix the two.
- `playwright` available in `node_modules` (already a project dependency via `@playwright/test`).
- The Penpot Components page has real library components registered (not just plain boards) — true as of the last Components sync. If `component.instance()` can't find something expected, treat it as a gap (Step 10), don't block.

**Input validation is mandatory before any shell command runs.** If the input resolves to a GitHub issue number, validate it against `^[0-9]+$` before it touches any bash/PowerShell command — reject and stop on anything else. Never interpolate an unvalidated value into a shell command.

## Steps

### 0. Parse the input

Input is either free-text requirement or a URL containing one (most commonly an X-Talent-Tracker issue link).

- Plain text → use directly as the requirement.
- A tracker issue URL → extract the issue number, validate `^[0-9]+$`, then:
  - **Bash**: `source .agents/scripts/load-config.sh || exit 1`
  - **PowerShell**: `. .agents/scripts/load-config.ps1`
  - `gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments,labels`
- Any other URL (Figma, Notion, etc.) → fetch and read it for requirement text; don't assume it's directly actionable beyond that.

### 1. Identify target route(s) and scope

Search `src/app/` for the route(s) this requirement is about, using its text as signal (feature name, path fragments, page already mentioned).

- One page → single-page sync.
- A requirement describing a journey ("A 頁面到 B 頁面") → multi-page flow sync; identify every route involved and the order they connect in.
- Zero or multiple high-confidence candidates → stop and ask the user which route(s) to use. Do not guess.

Then derive **interactive states** worth capturing per page, by reading that route's component code: things a user can toggle open/closed (hamburger menu, dropdowns, modals), not just static content. Only include states actually plausible for this page/flow — don't pad the list, and don't skip one the requirement explicitly asked for.

### 2. Determine roles × viewports scope

Default to the full sweep unless the requirement clearly narrows it:

- **Roles**: visitor / mentee / mentor — only the ones actually reachable for the route(s) in scope.
- **Viewports**: desktop, tablet portrait, tablet landscape, mobile portrait, mobile landscape — mapped to Playwright's `devices['Desktop Chrome']` / `'iPad Mini'` / `'iPhone 13'` presets.

If the requirement narrows scope ("只要 mentor 桌機版"), honor that and note the narrowed scope in the final report.

### 3. Confirm the Penpot connection

Call `high_level_overview` (skip if already read this session) then a lightweight `execute_code` (e.g. `return penpotUtils.getPages()`) to confirm the MCP session is actually connected to a live Penpot file. If it errors, stop and tell the user to check the Penpot Desktop/MCP connection, then retry — don't proceed against a dead connection.

### 4. Capture the live reference (Playwright)

Write a standalone Node script using the `playwright` package directly (not the `@playwright/test` runner — this is interactive capture, not a pass/fail test; and never reuse `e2e/helpers/session.ts`'s forged-cookie approach — that's the e2e suite's shortcut, not a real login).

For each (role × viewport) combination in scope:

1. Launch against `BASE_URL=https://xtalentdev.vercel.app` (the deployed dev site — never a local `pnpm dev` server).
2. Log in for real through the actual sign-in UI using the matching `DESIGN_AUDIT_MENTOR_*`/`DESIGN_AUDIT_MENTEE_*` credentials (visitor role = no login).
3. Navigate to the target route.
4. If (and only if) this page's API data is visibly broken (empty where it shouldn't be, obviously malformed, erroring), mock just that endpoint via `page.route(...)` (same pattern as `e2e/helpers/route.ts`'s `mockApiRoute`) with hand-written realistic data matching `src/types`. Prefer the real backend response otherwise — don't mock preemptively.
5. Screenshot the base state.
6. For each interactive state identified in Step 1 (menu open, dropdown expanded, etc.), perform the interaction and screenshot again.
7. For a multi-page flow, repeat from step 3 for each subsequent route, following the actual in-app navigation (click through, don't deep-link) so the captured flow matches how a user really moves between pages.

Save all screenshots to the scratchpad directory, named so state/role/viewport/page are recoverable from the filename alone.

### 5. Create the draft page

`penpot.createPage()`, named `Sync Draft — <short requirement summary> — <YYYY-MM-DD>`. All construction happens on this page only.

### 6. Reconstruct each captured state

For each screenshot from Step 4, build a board in the draft page that matches it:

1. For every recognizable UI piece that has a Components-library equivalent, place it via that component's `instance()` and adjust content/props to match the screenshot — don't hand-draw a Button when a `Button` component instance exists.
2. For page-specific content with no library equivalent (copy, images, one-off layout), build boards/text directly, using real token hex values (`src/design/tokens/color-values.ts`) exactly as the original Components sync did.
3. Images: reproduce as image fills where the screenshot shows real photographic/illustration content; solid-color placeholders are not an acceptable substitute for an actual image element.
4. Name every board/instance meaningfully (route + state + role + viewport at minimum) — this page will have many boards and unnamed ones are unreviewable.

### 7. Wire up Interaction/Flow

For every state transition and page-to-page navigation captured in Step 4 (menu closed → open, page A → page B), add a real Penpot Interaction from the triggering element to the target board, so the draft is clickable in Penpot's present mode — not just a wall of disconnected boards.

### 8. Auto-verify and self-correct

For each reconstructed board: compare it against its reference screenshot (`export_shape` the board, look at both side by side). Check for obvious defects — wrong colors, missing elements, broken layout, un-wired interactions. Fix and re-check once more if issues remain, then move on — don't loop indefinitely. This is a first-pass, same-context gate only; Step 9 is the real one.

### 9. Independent review

Launch a **fresh subagent, no shared context** from construction — the point is a reviewer that hasn't seen how or why anything was built. Read-only Penpot MCP access scoped to the new draft page; it never edits Penpot itself. Give it the requirement (Step 0), the scope derived in Steps 1–2, and the reference screenshots (Step 4). Task it to:

1. Independently confirm every expected role/viewport/state/page from Steps 1–2 has a corresponding board — report any gap.
2. Check each board against its reference screenshot and against the Core rule (real token colors, real component instances, no hardcoded/invented values).
3. Check every expected Interaction/Flow link (Step 7) actually exists.

If issues are reported: fix them, then re-trigger the review. Repeat up to **5 times**. If issues remain after 5 rounds, stop, carry them forward as known limitations for Step 10, and finish anyway — a draft with a noted gap still beats blocking indefinitely.

### 10. Report back

Reply in chat only — **no GitHub issue, no other output channel.** Include:

- The new Penpot page name and what it covers (routes × roles × viewports × states).
- Any narrowing applied from Step 2 (if the requirement limited scope).
- Any page where real backend data was broken and had to be mocked, and what was mocked.
- Any "codebase violation" found per the Core rule (site itself breaks CLAUDE.md styling rules).
- Any unresolved gaps carried forward from Step 9.

## Rules

- Always communicate with the user in Traditional Chinese (繁體中文).
- Never write into the canonical `Components` page or any pre-existing Penpot page — always a fresh draft page (Step 5).
- Never post to GitHub or any channel outside this chat and the Penpot draft.
- Never use `e2e/helpers/session.ts`'s forged-session-cookie approach — this skill logs in for real, against the real dev backend.
- Step 9's review pass is mandatory and must never be skipped, even under time pressure.
- Never guess the target route(s) when Step 1 is ambiguous — stop and ask.
