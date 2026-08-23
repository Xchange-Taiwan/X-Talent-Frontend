---
name: reproduce-component
description: 'Rebuild an interactive Lavish (or equivalent HTML artifact) preview of a component or page from its CURRENT source code, so the reproduction stays aligned as the component changes over time.'
argument-hint: <component or page name/path, e.g. "Header" or "src/components/profile/edit">
metadata:
  hermes:
    tags: [lavish, ui, prototype, rwd]
    category: productivity
---

# Reproduce Component

Rebuild a faithful, interactive HTML reproduction of an X-Talent component or page — not a static screenshot — reflecting the **current** state of its source code. This is the generalized version of a process first built for the Header (RWD + hamburger menu + dropdown menu); it now applies to any component or page.

## Request

$ARGUMENTS

If empty, ask which component or page to reproduce (or infer it from the conversation).

## Why this exists

The reproduction is a hand-built artifact, not generated code — it does not auto-update when the real component changes. Re-deriving the file list and re-learning the same layout gotchas from scratch each time is wasted work. This skill is the checklist: how to find the right source, and the mistakes already made once that should not be repeated.

## Step 0 — always applies: use the `lavish` skill and its X-Talent policy

This skill assumes `lavish` (`.agents/skills/lavish/SKILL.md`) for the actual artifact tooling (`lavish-axi`, open/poll/apply-feedback loop, versioning, `share` restrictions). Load it before writing HTML. Its **X-Talent policy** already governs design fidelity for every artifact in this repo — do not duplicate it here, just follow it:

- Colors/shadows/tokens come from `src/design/tokens/` as consumed by `tailwind.config.js` — never hardcode a hex value.
- Reuse the actual `src/components/ui/*.tsx` (CVA variant) styling rather than recreating a look freehand.
- Never run `share` on an artifact containing X-Talent product/UI/data.

## Step 1 — find the real source, every time

Don't trust a previous reproduction's file list if enough time has passed — components get renamed, split, or gain new sub-components. Rediscover:

1. `Glob`/`Grep` for the target's folder, e.g. `src/components/**/<Name>/**` or `src/app/**/<page>/**`.
2. Read every file in that folder — main component, sub-components, hooks it calls (`src/hooks/**`), and any dialogs/menus/sheets it opens.
3. For every `src/components/ui/*` primitive it uses (Button, Sheet, DropdownMenu, Dialog, etc.), read that primitive's source to get the **exact** variant classes — don't guess colors/spacing from memory of "what shadcn usually looks like."
4. Read `src/styles/tokens.css` for the actual hex values behind the color tokens (the file's comments carry the hex directly).
5. Read the component's `.stories.tsx` if present — it often documents the prop/state matrix (loading, empty, error, role-based variants) you should make togglable in the reproduction's control panel.

## Step 2 — build/update the artifact

- Location: `.lavish/<component-slug>.html` (kebab-case of the component/page name).
- Any breakpoint-dependent behavior (`sm:`/`md:`/`lg:` classes) must be simulated with **CSS container queries** on a resizable device-frame inside the page — not real viewport media queries — since the reproduction is embedded in a larger page, not the actual viewport.
- Any state that changes what renders (auth state, role, loading, empty, error, feature flags) becomes a control-panel toggle, not a hardcoded snapshot.
- Everything interactive in the real component (menus, dialogs, dropdowns, accordions, tabs) must actually open/close/respond in the reproduction — this is the entire point versus a screenshot.

## Known gotchas — cross-component patterns already hit once, don't repeat them

These came from reproducing the Header, but they are patterns of this codebase's stack (Radix + Tailwind + CVA), not header-specific — check for them in any component:

- **Radix primitives (`Sheet`, `Dialog`, `DropdownMenu`, `Popover`) portal their content out of the DOM subtree they're triggered from.** If the real trigger's ancestor has `position:relative`/`absolute` with a small fixed size (e.g. a 70px header bar), do NOT nest the reproduced overlay/panel inside that same ancestor — its `inset:0` will resolve against that small box, not the full page, and the "full screen" panel gets squashed. Place the overlay/panel as a sibling of the trigger's container instead, matching where Radix actually portals it (usually `document.body`).
- **shadcn/ui's `outline` Button variant has no color override by default** — border-background-border, inherited text color. Only look brand-colored when the calling component explicitly adds `border-brand-500 text-brand-500` (or similar) in its own `className`. Check each individual button's JSX for such overrides — don't assume every outline button in a menu shares the same color treatment.
- **When toggling visibility by state (auth/role/loading), preserve each element's own display mode**, don't blanket-apply `display:none`/`contents` to every "conditionally shown" element. An element relying on `flex` + `margin-top:auto` (or similar) to stay pinned within its container loses that positioning if forcibly set to `display:contents`. Check what layout role each element's own box plays before deciding what display value hides/shows it.
- **Reproduce unusual-looking spacing/margins as-is** (e.g. an asymmetric `lg:mr-20`) rather than "fixing" them — this skill produces a faithful mirror of production, not a redesign. Flag anything that looks like a real bug to the user in prose instead of silently correcting it in the reproduction.

## Rules

- Prefer editing an existing `.lavish/<slug>.html` in place over a full rewrite, unless the component's structure changed enough that a rewrite is cleaner.
- State which design source was used when reporting back (per the `lavish` skill's requirement) — for this repo it is almost always "this repo's own tokens/components."
- After any fix made during a review round, state the concrete root cause in the reply, not just "fixed it" — that's what keeps this checklist worth maintaining.
- Keep the artifact self-contained except for a Google Fonts CDN link when the project's fonts aren't system fonts.
