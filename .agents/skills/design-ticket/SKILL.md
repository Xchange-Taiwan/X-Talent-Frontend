---
name: design-ticket
description: "Read a GitHub ticket and design the corresponding UI directly in Figma via genable-mcp, grounded in this codebase's design tokens, existing components, and the relevant page's current implementation."
disable-model-invocation: true
---

Design a ticket's UI in Figma using genable-mcp, driven entirely by what already exists in this codebase — not by what's currently in the Figma file.

## Core rule — everything must match project style

All output must match the project's existing visual language:

- Use only the colors/spacing/radius/typography defined in `src/design/tokens/` (bind Figma variables to these, don't hardcode hex/px values).
- Prefer reusing components already in `src/components/` (and their real variants) over inventing new visual patterns.
- Follow the layout rhythm (spacing, alignment, layout pattern) already present on the target page.
- Only design a brand-new component when the codebase genuinely has no equivalent — and even then, build it out of the same token set.

## Prerequisites

- `gh` CLI authenticated.
- A Figma file open with the genable plugin connected (genable-mcp always operates on whichever file the user currently has open — this skill cannot target a specific file).

**Input validation is mandatory before any shell command runs.** `<issue-number>` comes from user input. Before executing any bash/PowerShell command in this skill, strictly validate that `<issue-number>` matches `^[0-9]+$` — reject and stop on anything else (e.g. `123; rm -rf .`). Never interpolate the raw, unvalidated value into a shell command.

## Steps

### 0. Fetch and parse configuration

- **Bash**: `source .agents/scripts/load-config.sh || exit 1`
- **PowerShell**: `. .agents/scripts/load-config.ps1`

### 1. Fetch the ticket

Validate `<issue-number>` against `^[0-9]+$` first (see Prerequisites). Then:

```bash
gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments,labels
```

### 2. Identify the target page in the codebase

Search `src/app/` for the route this ticket is about, using the ticket title/body/labels as signal (feature name, path fragments, existing page mentioned).

- One high-confidence match → use it.
- Zero or multiple candidates → stop and ask the user which page/route path to use. Do not guess.

### 3. Ground the design in the codebase (not in Figma)

Read, in this order:

1. **Design tokens** — `src/design/tokens/` (colors, spacing, radius, typography).
2. **Available components** — read the actual source under `src/components/` (e.g. the CVA `variants` config in `src/components/ui/*.tsx`) for real prop/variant values.
3. **The target page** — the current implementation found in step 2, including which components it already uses and how it's laid out.

### 4. Derive the relevant UX states

Dynamically infer which states this feature actually has, by reading:

- The ticket text itself (explicit states mentioned).
- The target page's code — `useState` toggles, `useSession`/auth checks, loading/error branches, conditional rendering.

Then cross-check against this fallback checklist so common states aren't missed: logged-in vs logged-out, closed vs open/expanded, default vs loading vs error/empty, mobile vs desktop breakpoint. Only include states that are actually plausible for this feature — don't pad the list.

### 5. Confirm the Figma connection

Call `get_selection` (or `inspect({node: "/"})`) to confirm genable is connected to an open Figma file. If it errors, stop and tell the user to open the Figma file with the genable plugin connected, then retry.

### 6. Create a dedicated page for this ticket

```
create_page({ name: "#<issue-number> <ticket-title>", switchTo: true })
```

All work happens on this new page — never on whatever page the user had open. This isolates the ticket's exploration from the user's existing work.

### 7. Design at least 3 overall directions

Produce **at least 3 distinct overall design directions** (different layout/composition approaches to solving the ticket), not 3 variants per state. Each direction is its own frame/frame-group and must internally cover every state derived in step 4.

For each direction, when placing a component:

1. Look up the component name directly in Figma (e.g., `Button`, `Avatar`) or search using a fallback query to find its Figma component name.
2. `find_nodes({ query: "<figmaComponent>" })` to get the master's node ID (fall back to `list_file_components_for_code_connect`-style search if not found by exact name).
3. `create_instance` (or `<instance ref="...">` inside a `jsx()` call) to place it, using `props`/`variant` overrides that match the real prop values read from source in step 3.
4. Bind fills/spacing to design tokens via `bind_variable` rather than hardcoding values.

If no codebase component matches what the ticket needs, build a new component from scratch with `jsx`/`create_component`, still bound to the same token set.

### 8. Auto-verify and self-correct

For each direction's root frame:

1. `inspect({ node, facets: ["layout", "lint"] })` and `get_screenshot({ node })`.
2. Check for obvious layout defects: overlapping nodes, content overflowing its frame, broken alignment, inconsistent spacing versus the token scale.
3. If found, fix via `jsx`/`edit`/`edit_jsx` and re-screenshot. Repeat once more if issues remain, then move on — don't loop indefinitely.

No human confirmation gate before or during generation — this step is the only quality gate, and it's automated.

### 9. Report back to the ticket

For each direction, take a final `get_screenshot` of its root frame. Then:

1. Commit the PNGs to a **per-issue** branch `design-assets/<issue-number>` (create it fresh from the default branch if it doesn't exist yet) under `design-tickets/<issue-number>/direction-<a|b|c>.png`. Using one branch per issue avoids concurrent pushes from different tickets ever colliding on the same branch. Before pushing, always `git fetch origin design-assets/<issue-number>` and rebase/merge if the branch already exists remotely (e.g. from a prior run of this skill on the same ticket) — never force-push. If push is rejected as non-fast-forward, pull/rebase and retry once; if it still fails, stop and report the conflict instead of forcing.
2. Post a single comment on the ticket with `gh issue comment <issue-number> --repo "$ORG/$TRACKER_REPO"` containing, per direction: an image link using `https://github.com/$ORG/$FRONTEND_REPO/blob/design-assets/<issue-number>/design-tickets/<issue-number>/direction-<a|b|c>.png?raw=true` (rendered inline via markdown `![...]`) — this works for private repos because it resolves through the viewer's own GitHub session rather than an unauthenticated raw-content URL — and a "Copy link to selection" style Figma URL to that direction's frame (`https://www.figma.com/design/<file-key>/...?node-id=<id>`).

## Rules

- Always communicate with the user in Traditional Chinese (繁體中文).
- Never modify application code — this skill only writes to Figma (and pushes screenshots to the `design-assets` branch in step 9).
- Never guess the target page or Figma file — stop and ask when step 2 is ambiguous; step 5's connection check is mandatory before any write.
