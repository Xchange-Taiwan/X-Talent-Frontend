# ADR 0001: Session-Hint Cookie for Flash-Free Header (Mentor Status / Avatar)

- **Status:** Shipped (code); ticket X-Tracker #525 confirmed as stale and scheduled for closure with rewritten ACs (see below)
- **Date:** 2026-08-03 → 2026-08-04 (implementation); reconciled via retro interview with the implementer on 2026-08-04
- **Tracker:** [X-Tracker #525](https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/525) — "Header: render mentor-status text and avatar from SSR-read session hint (no flash)"
- **PRs:** [#888](https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/888), [#891](https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/891), [#892](https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/892), [#893](https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/893), [#896](https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/896)

## Context

The header renders role-dependent UI (mentor-status text, avatar) that depends on session state. Client-only session resolution (`useSession()`) causes a visible flash on first paint: the header renders in a signed-out/default state, then snaps to the real state once the session hook resolves.

Ticket #525 mandated a specific fix: read and decode a session-hint cookie **server-side, inside the root layout (a Server Component)**, and pass the decoded value down so the first client render already matches the eventual session state. The hint payload was also to be extended to carry the avatar URL (sourced from `token.avatar`).

An automated ticket-review comment on the same day flagged three blocking questions before implementation should start:

1. Calling `cookies()` in the root layout opts the **entire site** into dynamic rendering, eliminating SSG/ISR for every route — a significant architectural change.
2. Adding an avatar URL to the cookie risks hitting the ~4KB cookie size cap.
3. `token.avatar` is not a standard NextAuth JWT field (`token.picture` / `token.image` are conventional) — unconfirmed whether it exists at all.

The review agent's recommendation was "Needs Technical Clarification" — i.e., implementation was not yet green-lit to proceed as specified.

## Decision (what actually shipped)

Across 5 PRs merged over ~6.5 hours, the implementation shipped a **different mechanism than the one the ticket specified**:

- **No `cookies()` read in the root layout.** Instead, `src/app/layout.tsx` injects a synchronous inline `<script>` (`SESSION_HINT_INLINE_SCRIPT`) into `<head>` that reads `document.cookie` on the client, before hydration, and sets `data-auth-state` / `data-auth-avatar` DOM attributes plus a `--auth-avatar` CSS variable. The header renders correctly via pure CSS/attribute toggles before React hydrates — sidestepping the SSG/ISR blocking question entirely, since the root layout stays static.
- The cookie payload format is `isMentor|userId|avatar`, defined in `src/lib/auth/sessionHint.ts`. `userId` was **not in the original ticket scope** — it was added later (see Divergence 3).
- Cookie-size risk (blocking question 2) is mitigated: avatar is dropped entirely from the payload if the encoded value exceeds 1000 characters.
- Payload-tampering / bad-URL risk is mitigated by `isValidAvatarProtocol()`, which allow-lists `http(s)://` and root-relative `/` paths; decoding never throws.
- The `token.avatar`-vs-standard-field question (blocking question 3) is resolved pragmatically in `src/middleware.ts` with a fallback chain: `token?.avatar || token?.picture`.
- `src/middleware.ts` only re-issues the `Set-Cookie` when the encoded hint value actually changes, to stay CDN-cache-friendly.
- `src/hooks/user/auth/useAuthStatus.ts` merges `useSession()` with the hint and exposes an explicit `isResolvingUser` state, so `userId`-dependent links can't route to a signed-out destination during the resolution gap.
- No backend changes were required or made — `token.avatar`, `token.isMentor`, `token.id` already existed in `src/auth.config.ts` before this work started. `X-Talent-Backend` has no commits referencing #525 or session-hint.

## Timeline

| PR   | Merged (UTC)         | What it did                                                                                                                                                                                                                             |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #888 | 2026-08-03 20:38:54Z | First cut: `useSessionHint` hook, `src/lib/auth/sessionHint.ts`, middleware changes                                                                                                                                                     |
| #891 | 2026-08-03 21:36:30Z | Encodes avatar URL into the hint; introduces the SSG-friendly inline head-script + CSS-toggle mechanism (the pivot away from the ticket's `cookies()`-in-layout approach)                                                               |
| #892 | 2026-08-03 21:38:02Z | Cookie encode/decode definition + tests; `useSessionHint` DOM-state syncing + middleware tests. Merged 2 minutes after #891, touching overlapping files — likely a stacked/split PR pair rather than an independently reasoned decision |
| #893 | 2026-08-04 01:03:45Z | Adds dedicated `useCurrentAvatar` hook with session-hint fallback                                                                                                                                                                       |
| #896 | 2026-08-04 03:00:53Z | **Bug fix + scope add.** Root cause: `response.cookies.set()` auto-URL-encodes the whole cookie value including the `                                                                                                                   | `separator, but both read paths split on a literal` | `*before* decoding — decode silently failed on every request. Also fixes the same decode-before-split bug in middleware's change-detection (was causing`Set-Cookie`on every navigation, defeating CDN cacheability). Adds`userId`to the payload. Removes a redundant wrapper`div`in`Header.tsx` |

## Divergences from stated intent — resolved via retro interview (2026-08-04)

1. **Mechanism substitution, undocumented as a decision.** The ticket mandated a Server Component `cookies()` read; the shipped solution is a client-side pre-hydration inline script. **Confirmed:** this was an implementation-time judgment call, not a discussed/documented decision — the implementer recalls the `cookies()` approach being slower but no longer remembers specifics, and no measurement or written rationale exists anywhere (ticket, PR, or elsewhere). This ADR is the first record of the rationale, reconstructed from memory rather than contemporaneous notes.
2. **The ticket's own acceptance criteria were not met by the code that shipped against it.** The "no flash" AC was silently broken across #888–#893 (~6 hours, 4 merged PRs) due to the decode-before-split bug. **Confirmed:** how this was caught is unknown/unrecorded — there was no traceable test or verification step confirming the AC actually held during that window. This is a process gap, not just a one-off bug.
3. **PRs #891/#892 split across the same files, merged 2 minutes apart.** **Confirmed root cause:** the underlying PR was too large for the AI coding agent to process, so it was manually split into smaller PRs for review. No end-to-end verification step was paired with the split — which is the same gap as #2 above, and plausibly why the encode/decode mismatch crossed PR boundaries undetected.
4. **Scope creep without ticket update.** `userId` was folded into the cookie payload in #896, which is not in the original 5 ACs. **Confirmed:** adding `userId` was a deliberate, justified call (already public via `/profile/{userId}`, UI-only use). Failing to update the ticket to reflect the expanded scope was not a deliberate team norm — it was simply not done.
5. **Ticket/code drift.** #525 was left open with its original ACs unchecked despite 5 merged PRs closing out the actual (divergent) work. **Resolved:** ticket is being closed with ACs rewritten to match the shipped mechanism plus the `userId` scope addition (see below).

## Process gap identified (not yet ticketed)

Items 2 and 3 above share a root cause: PRs are being split purely to fit an AI review agent's read limits, with no paired end-to-end verification step. That gap is almost certainly why the encode/decode mismatch (cookie value auto-`encodeURIComponent`'d, but both read paths split on a literal `|` before decoding) shipped across 4 separate PRs before being caught. **This has not yet been filed as a tracker ticket** — flagging here so it isn't lost; file it separately if/when prioritized.

## Forward-looking decisions confirmed

- The inline-script mechanism is the **intended long-term solution**, not a stopgap — there is no planned revisit of the SSR-`cookies()`-in-root-layout approach.
- #525 will be **closed**, with its acceptance criteria rewritten to describe the shipped inline-script mechanism and the `userId` payload addition, rather than the originally-specified (and abandoned) approach.

## Consequences

- Root layout remains statically renderable (SSG/ISR preserved) — the architectural risk the review agent flagged did not materialize, but only because the ticket's specified approach was quietly abandoned rather than resolved as specified.
- The cookie hint format (`isMentor|userId|avatar`) is now a de facto public contract between `src/middleware.ts`, `src/lib/auth/sessionHint.ts`, and the inline script — any future field addition should reuse the same size-guard and protocol-allowlist pattern rather than re-deriving it.
- Because #525 is still open and doesn't reflect the shipped mechanism, anyone reading the ticket without also reading the PRs will get a materially wrong picture of what was built — this ADR exists to close that gap.
