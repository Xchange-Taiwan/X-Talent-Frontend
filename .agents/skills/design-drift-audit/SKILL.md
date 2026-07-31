---
name: design-drift-audit
description: "Audit one route on the deployed site against this codebase's design tokens/components, detect design drift, then produce a Design Drift Report (GitHub issue) and a Figma Sync Draft page via genable-mcp — grounded in the live site/code as source of truth, not the other way around."
disable-model-invocation: true
---

Audit a single route on `https://xtalentdev.vercel.app` against what this codebase says it _should_ look like, across every applicable user role and screen size, and surface the gap to a designer for review — never applied automatically.

## Core rule — code/site is truth, Figma is what gets corrected

The deployed site and this codebase are always assumed correct. Figma is the artifact allowed to be stale. The one exception: if the live site itself violates this repo's own styling rule (`no inline style props, no hardcoded colours` — see root `CLAUDE.md`), that is a **codebase violation**, not "Figma is behind" — report it separately and never carry it into the Figma Sync Draft. Don't launder a code bug into the design system as if it were an intentional pattern.

Never invent token values, component props, or variants. Every claim of "this should be X" must trace back to something actually read from `src/design/tokens/` or `src/components/ui/*.tsx` — if a needed value isn't found there, say so instead of guessing.

## Prerequisites

- `gh` CLI authenticated.
- A Figma file open with the genable plugin connected (genable-mcp operates on whichever file is currently open).
- Playwright installed (`pnpm exec playwright install` if browsers are missing).
- Test credentials for the two logged-in roles, in `.env.development.local` (gitignored, matches `.env*.local` in `.gitignore`) or `.env`:
  ```
  DESIGN_AUDIT_MENTOR_EMAIL=
  DESIGN_AUDIT_MENTOR_PASSWORD=
  DESIGN_AUDIT_MENTEE_EMAIL=
  DESIGN_AUDIT_MENTEE_PASSWORD=
  ```
  These are dedicated to this skill — separate from `E2E_EMAIL`/`E2E_PASSWORD` (used by the Playwright e2e suite) to avoid the two purposes interfering with each other. Any script this skill writes must explicitly load `.env.development.local` (and fall back to `.env`) via `dotenv` — this is not the e2e suite's `playwright.config.ts`, so nothing loads these automatically.
- Never print, log, or commit credential values anywhere (script output, GitHub issue body, Figma frame text, commit messages).

**Input validation is mandatory before any shell command runs.** `<route>` comes from user input. Before executing any bash/PowerShell/URL-construction using it, strictly validate it matches `^\/[a-zA-Z0-9\-_\/]*$` — reject and stop on anything else (e.g. path traversal, query strings, shell metacharacters). Never interpolate the raw, unvalidated value into a shell command.

## Steps

### 0. Fetch and parse configuration

- **Bash**: `source .agents/scripts/load-config.sh || exit 1`
- **PowerShell**: `. .agents/scripts/load-config.ps1`

This provides `$ORG`, `$TRACKER_REPO`, `$FRONTEND_REPO`.

### 1. Resolve the route

Validate `<route>` against `^\/[a-zA-Z0-9\-_\/]*$` (see Prerequisites). Confirm it resolves to a real page under `src/app/` — zero or ambiguous matches means stop and ask the user, don't guess.

### 2. Determine which roles actually apply to this route

Read the route's source (layout/page files, middleware, auth checks) to decide which of **visitor (logged-out) / mentee / mentor** are actually reachable states for this route:

- A public marketing page → visitor only.
- A role-gated page → whichever role(s) can reach it (per this app's two logged-in roles, mentor and mentee).

Don't pad the list with roles that can't actually see this route (e.g. don't audit a mentor-only settings page as mentee).

### 3. Capture the live site across every applicable role × viewport combination

Viewport set (5 total, matching Playwright's built-in device descriptors so results correspond to real devices):

| Slot             | Playwright device                |
| ---------------- | -------------------------------- |
| Desktop          | `devices['Desktop Chrome']`      |
| Tablet portrait  | `devices['iPad Mini']`           |
| Tablet landscape | `devices['iPad Mini landscape']` |
| Mobile portrait  | `devices['iPhone 13']`           |
| Mobile landscape | `devices['iPhone 13 landscape']` |

For each applicable role:

- **visitor**: no auth, navigate directly to `https://xtalentdev.vercel.app<route>`.
- **mentee** / **mentor**: sign in first using that role's `DESIGN_AUDIT_*_EMAIL`/`DESIGN_AUDIT_*_PASSWORD` (via the app's real login flow, same as `e2e/global-setup.ts`'s approach, but with its own storage state — don't reuse or collide with the e2e suite's `e2e/.auth/` state), then navigate to the route.

For each role × viewport combination, capture: a full-page screenshot, the rendered DOM (class names in particular — this codebase is Tailwind-utility-only, so classnames are the fastest signal for token vs. hardcoded/arbitrary values), and computed styles for any node using an arbitrary Tailwind value (`bg-[...]`, `style="..."`, etc.).

Write this as a small standalone Playwright script (not part of `e2e/`, since this isn't a pass/fail test suite) — scratch it under a temp location, it doesn't need to be committed.

### 4. Ground expectations in the codebase

Read, in this order:

1. **Design tokens** — `src/design/tokens/` (`color.ts`, `color-values.ts`, spacing/radius/typography).
2. **Real component contracts** — `src/components/ui/*.tsx`, specifically each component's CVA `variants` config, for actual prop/variant values. (There is no pre-built `figma-component-map.json` — that file does not exist in this repo; read the source directly.)
3. **The route's actual implementation** found in step 2 — which components it uses, how it's laid out, its own conditional/breakpoint logic.

### 5. Classify drift

For each role × viewport capture, compare what was seen against step 4's expectations and sort findings into exactly one of:

- **Figma drift** — the live site correctly uses a real token/component/variant, but Figma's current definition doesn't reflect it (new variant, changed spacing, layout change, new section/pattern). This is what gets synced to Figma.
- **Codebase violation** — the live site uses a hardcoded/arbitrary value that isn't a token and isn't a real component variant, violating `CLAUDE.md`'s own styling rule. Report only — never sync to Figma.

Don't report a finding you can't tie to a specific token/component/file reference from step 4.

### 6. Compare against Figma via genable-mcp

Use **genable-mcp**, not the official Figma MCP (`use_figma`/`get_design_context` etc.) — this account's Figma plan quota is already exhausted, and genable-mcp is this project's established path for both reading and writing Figma (same tool `design-ticket` uses).

- Look for an existing baseline frame for this route (e.g. a page named `Drift Baseline — <route>`). Use `find_nodes`/`get_selection`/`inspect` to check.
- **If no baseline exists**: create one now from what step 3 captured (screenshot + structure) via `create_page`/`create_component`/`jsx`, tag it clearly as a baseline (e.g. page name `Drift Baseline — <route> (auto-created <date>)`), and treat this run as having no prior-Figma-drift to report for this route (there's nothing to diff against yet) — still report anything from step 5.
- **If a baseline exists**: diff the current step-5 findings against it to see what's actually new drift since the baseline was last updated, then after publishing (step 8) update the baseline to reflect the now-current live state.

### 7. Independent review pass — mandatory

Before publishing anything, put every flagged item (both Figma drift and codebase violations) through a fresh subagent review — same principle as `design-ticket`'s Pass 1/Pass 2: an agent that hasn't seen how the finding was produced is not blind to the same assumptions.

Launch a subagent with:

- The route, the applicable roles, the raw captures from step 3 (screenshots/classnames/computed styles).
- The codebase facts from step 4 (tokens, component variants, route source) — but **not** this session's own drift classification or reasoning.

Task it to independently re-derive which items are real drift (and which bucket each belongs in) and report any it disagrees with. If it disagrees with a finding, drop or reclassify that finding — don't argue with the reviewer. If it flags something new, fold that in too, but don't manufacture a review cycle: run this once per route per invocation, not in a retry loop.

### 8. Publish outputs

1. **Design Drift Report** — file a new issue via `gh issue create --repo "$ORG/$TRACKER_REPO"`, titled `[Design Drift] <route>`, body organized by role then viewport, each finding tagged Figma-drift vs codebase-violation with the specific token/component/file it traces to. Attach screenshots the same way `design-ticket` does (commit PNGs to a per-route branch under `design-drift/<route-slug>`, link via the `?raw=true` GitHub blob URL pattern so they render for private repos).
2. **Figma Sync Draft** — via genable-mcp, `create_page({ name: "Drift Sync Draft — <route> (<date>)" })` and build frames there proposing the Figma-drift items only (never the codebase-violation items, never write directly into the canonical design-system pages/components). Bind any values to real variables via `bind_variable`, same discipline as `design-ticket` step 7.
3. Cross-link: the GitHub issue body includes a link to the new Figma draft page/frame; nothing needs to go the other direction since Figma pages don't need to reference GitHub.

## Rules

- Always communicate with the user in Traditional Chinese (繁體中文).
- Never modify application code — this skill only writes to Figma (the isolated draft page + baseline pages) and to GitHub (the issue, and the screenshot branch).
- Never guess the route or which roles apply — stop and ask when step 1/2 is ambiguous.
- Never sync a codebase violation into Figma — it goes in the report only.
- Never overwrite an existing Figma baseline or the canonical design-system pages directly; sync proposals always land on a new draft page for a human to apply.
- Step 7's review pass is mandatory and must never be skipped.
- Never log, print, or persist the `DESIGN_AUDIT_*` credential values anywhere outputs are visible (issue body, Figma text, commit messages, console output beyond the local Playwright run itself).
