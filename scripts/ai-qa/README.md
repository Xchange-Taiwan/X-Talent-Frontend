# ai-qa — AI QA Agent stage for `ai:dev`

Runs after the AI reviewer in `pnpm ai:dev`'s dev → lint/type-check → review
loop (see `scripts/ai-dev/README.md`). Where the reviewer only reads the
diff, this stage actually boots the app and drives it with a real browser to
check the ticket's functional requirements, then posts a report (with
before/after screenshots) as a comment on the auto-created PR.

Full design discussion and the technical decisions behind this (why sessions
are minted instead of driving the sign-in form, why before-shots use a
`git worktree`, why API mocking is a standalone HTTP server instead of MSW,
etc.) are recorded on
[X-Talent-Tracker#318](https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/318).

## Prerequisites

`pnpm add -D @playwright/mcp` (already added) + `npx playwright install chromium`.
That's it — by default scenarios run against a local mock API server (see
below), so no real backend account setup is required.

## What it does

1. A **scenario planner** turns the ticket + diff into up to 5 concrete,
   browser-executable scenarios, each tagged with the role (`visitor` /
   `mentee` / `mentor`) it needs. Diffs with no observable UI/behavioral
   impact are marked `not-applicable` and skipped.
2. A **fixture planner** looks at the same ticket + diff and drafts mock
   JSON responses for whatever additional backend endpoints (beyond login)
   the scenarios are likely to call.
3. A standalone **mock API server** (`lib/mock-api-server.mjs`) starts on an
   ephemeral port, seeded with a baseline `/v1/auth/login` handler plus the
   fixture planner's output. Any endpoint the fixture planner didn't plan a
   fixture for, but that genuinely exists in the OpenAPI contract, still gets
   a generic response sampled from that contract's schema (`lib/schema-mock.mjs`,
   backed by the `scripts/ai-qa/openapi-spec.json` snapshot — see "Mock API
   server vs. a real backend" below) instead of 404ing. This is a real local
   HTTP server, not MSW — MSW patches the process making the requests, which
   doesn't fit here since the QA dev server runs as a separate child process;
   pointing `NEXT_PUBLIC_API_URL` at a real local server covers both client-
   and server-side calls with zero changes to `src/`.
4. A real `next dev` server is booted on an ephemeral port, with
   `NEXT_PUBLIC_API_URL` pointed at the mock server, for the current working
   tree.
5. Each scenario runs in its own isolated browser session (via
   `@playwright/mcp`, driven in-process — no subprocess/stdio plumbing) under
   the role's session, injected by minting a NextAuth JWT cookie from a real
   login call against the mock server (or a real backend — see
   `QA_USE_REAL_BACKEND` below) rather than driving the sign-in form.
6. Desktop screenshots (interactive end state) + a supplementary mobile
   screenshot (navigation-only) are captured per scenario.
7. The pre-ticket ("before") screenshot for each route is captured once per
   `ai:dev` run from a throwaway `git worktree` checked out at the merge-base
   with `develop` (its dev server also points at the same mock API server),
   and cached for the rest of that run's retry rounds.
8. Before/after images are composited (`sharp`) and pushed to a small,
   dedicated **public** repo (`<owner>/X-Talent-Frontend-PR-Image-Public`,
   auto-created on first use — `lib/artifacts.mjs`) — never this repo's git
   history, so there's no branch here to grow or clean up. It has to be
   public: an unauthenticated fetch of a private repo's raw content URL
   404s, and GitHub only serves private raw content via a token that expires
   in minutes, useless for an image meant to keep rendering in a PR comment
   for as long as the PR stays open (see issue #318 for the full
   investigation, including why a Gist doesn't work for this — it can't
   store real binary content).
9. Once `attemptAutoPr` in `scripts/ai-dev/orchestrator.mjs` successfully
   opens the PR, the QA report (summary table + screenshot links) is posted
   as a follow-up `gh pr comment`.

## Mock API server vs. a real backend

**Default: mock.** A fresh mock server starts per QA run. Role sessions log
in with fixed sentinel emails (`qa-mentor@mock.local` / `qa-mentee@mock.local`
— see `lib/mock-api-server.mjs`) that the mock server's `/v1/auth/login`
handler recognizes. Requests are resolved in order:

1. An exact-match fixture — login, or one the fixture planner (or a
   scenario) registered. Realistic, scenario-aware data.
2. A generic baseline sampled from the OpenAPI contract
   (`lib/schema-mock.mjs`) for any endpoint the contract defines but nobody
   registered a fixture for — e.g. a pre-existing endpoint a page calls that
   this ticket's diff didn't touch, so the fixture planner (which only reads
   the diff) had no way to know about it. Field values come from each
   schema field's declared `default`, or a type-based zero value (`''`, `0`,
   `false`, `{}`) — plausible shape, not scenario-realistic content.
3. 404, loudly, instead of silently returning a plausible-but-wrong
   response — only for a path that isn't in the OpenAPI contract at all, so
   a genuinely wrong/unexpected endpoint call still surfaces as a "ghost
   mock masking a real bug" signal rather than being papered over.

The schema baseline is sampled from `scripts/ai-qa/openapi-spec.json`, a
snapshot of the same `BFF_OPENAPI_URL` spec that generates `src/types/api.ts`
— regenerated together by `pnpm generate:types`, so it can't drift out of
sync with the real contract. If that snapshot is missing, step 2 is simply
skipped (falls straight through to 404) rather than erroring.

**Opt-in: real backend.** Set `QA_USE_REAL_BACKEND=1` to skip the mock
server entirely and hit whatever `NEXT_PUBLIC_API_URL` already points to.
Pairs with real QA test account credentials in `.env.development.local`:

```
QA_TEST_ACCOUNT_MENTEE_EMAIL=
QA_TEST_ACCOUNT_MENTEE_PASSWORD=
QA_TEST_ACCOUNT_MENTOR_EMAIL=
QA_TEST_ACCOUNT_MENTOR_PASSWORD=
```

Which credentials get used is driven entirely by `QA_USE_REAL_BACKEND`, not
by whether these happen to be set — leftover values from a previous
real-backend run are ignored while running in (default) mock mode, so they
can't silently get sent to the mock server and resolve to the wrong role.

## Environment variables

- `SKIP_QA=1` — skip the whole stage (useful for a fast local iteration loop).
- `QA_USE_REAL_BACKEND=1` — see above.
- `AI_QA_BLOCKING=false` — opt out of having a `failed` QA result (a genuine
  scenario assertion mismatch) block auto-PR and feed back into the dev
  agent's next retry round. **Default is blocking**, matching issue #318's
  original gating rule — any value other than the literal string `false`
  blocks. `infra-error` / `not-applicable` never block, regardless of this
  flag. Reach for `AI_QA_BLOCKING=false` when chasing a suspected false
  positive (e.g. the fixture planner missed an endpoint the scenario
  actually needed — see "v1 scope" below) rather than a real bug.

## Status values

- `not-applicable` — no observable UI/behavioral impact, scenarios skipped.
- `passed` — every scenario's expected result held.
- `failed` — at least one scenario's expected result did not hold. A genuine
  functional problem, not a harness issue.
- `infra-error` — something on our side broke (dev server didn't boot, mock
  API server / real backend login failed, browser session crashed, turn
  budget exhausted without a verdict). Never treated as a code bug.

## v1 scope (by design)

- **Fixture planner covers common cases, not every endpoint** — it's an LLM
  guessing which endpoints matter from the diff and drafting scenario-realistic
  responses, so it can miss an endpoint the diff doesn't mention. The schema
  baseline (`lib/schema-mock.mjs`, see above) is the safety net for that gap:
  it guarantees any endpoint the OpenAPI contract defines gets _some_ valid
  response, just not a scenario-realistic one — a scenario that depends on
  specific data in that endpoint's response (not just "the page renders
  without erroring") may still need the fixture planner to have gotten it
  right, or a manually-registered fixture.
- **Only an endpoint outside the contract entirely still 404s** — and even
  then, whether that becomes a reported `infra-error` (harness issue) versus
  `failed` (genuine bug) depends on the QA agent's own LLM correctly
  recognizing the 404 as an environment problem (`classification:
'environment-error'` — see `lib/qa-agent.mjs`); it isn't automatic.
- **No CI integration.** Local `ai:dev` only.
