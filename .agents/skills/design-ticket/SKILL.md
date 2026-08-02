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

No human confirmation gate before or during generation — this step is a first-pass, same-context gate only. Step 9 below is the real quality gate.

### 9. Independent review (per direction)

Immediately after step 8 finishes for a direction — before moving on to the next direction — put that direction through two independent review passes. This step is **mandatory for every direction, every run**; it cannot be skipped to save time.

Each pass is a **separate Agent tool call, launched fresh with no shared context** from generation or from the other pass — the whole point is a reviewer that hasn't seen how or why the direction was built, so it isn't blind to what its own author took for granted. The reviewer subagent only reads (ticket, codebase, Figma via genable-mcp) and reports findings — it never edits Figma itself. Applying fixes stays with this session, since fixing a gap coherently (e.g. a new collapsed-header frame matching the opened one) requires the design context of the direction that only the generating flow has.

**Pass 1 — Coverage review**

Launch a fresh subagent with the ticket text (step 1), the target page's source (steps 2–3), and read-only genable-mcp access scoped to this direction's root frame. Task it to:

1. Independently derive this ticket's full expected coverage — interaction states, before/during/after states, loading/empty/error states, role variants (visitor / mentee / mentor — this codebase's two logged-in roles plus logged-out, per the mentor/mentee model), and mobile/desktop breakpoints. Same discipline as step 4: only include what's actually plausible for this feature, don't pad.
2. Call `find_nodes`/`inspect`/`get_screenshot` against the direction's actual frame to see what was actually built.
3. Report the gap — which expected states/roles/breakpoints have no corresponding frame.

If gaps are reported: this session adds the missing frames using step 7's placement method (same component-lookup/token-binding discipline), then re-triggers Pass 1 on the updated frame. Repeat up to **5 times**. If gaps remain after 5 rounds, stop retrying and proceed to Pass 2 regardless — a direction with a gap still deserves its existing frames being polished.

**Pass 2 — Visual and compliance review**

Launch a separate fresh subagent (no context from Pass 1 or from generation) with the direction's current screenshot(s), the design tokens (step 3), and the components read in step 3. Task it to check:

- Spacing, alignment, hierarchy, overflow, and component-usage consistency across the frame(s).
- RWD quality — not merely that a breakpoint frame exists (Pass 1's job) but that it actually reflows sensibly.
- Compliance with this skill's **Core rule** — no hardcoded hex/px values (must be bound via `bind_variable`), and only real components/variants from `src/components/` used where one fits.

If issues are reported: this session fixes them via `jsx`/`edit`/`edit_jsx`, re-screenshots, then re-triggers Pass 2. Repeat up to **5 times**. If issues remain after 5 rounds, stop and move on to the next direction.

## Rules

- Always communicate with the user in Traditional Chinese (繁體中文).
- Never modify application code — this skill only writes to Figma.
- Never guess the target page or Figma file — stop and ask when step 2 is ambiguous; step 5's connection check is mandatory before any write.
- Step 9's review passes are mandatory and must never be skipped, even under time pressure — they are the only defense against reviewing your own work with the same blind spots you had while creating it.
