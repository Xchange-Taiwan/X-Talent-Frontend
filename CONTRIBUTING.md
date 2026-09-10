# Contributing

## Test coverage floor

CI (`.github/workflows/test.yml`) runs `pnpm test:coverage` on every pull
request. The coverage thresholds are configured in `vitest.config.mts`
(`test.coverage.thresholds`), and Vitest fails the run when any metric drops
below its floor - the failure message names exactly which metric (statements,
branches, functions, or lines) missed its threshold, e.g.:

```
ERROR: Coverage for branches (76.5%) does not meet global threshold (77%)
```

### Policy: the floor only ratchets up

- The coverage floor exists to lock in the current coverage level and stop it
  from silently regressing. As real coverage grows above the floor, raise the
  floor to match (leaving the same small buffer described below) - do not let
  it drift far behind actual coverage.
- **Lowering the floor requires a stated reason.** A PR that lowers any
  threshold in `vitest.config.mts` must explain why in the PR description
  (e.g. a large deletion of already-well-tested code, a deliberate
  descope of an area, a threshold that turned out to be flaky/unrealistic).
  Reviewers should treat an unexplained decrease as a blocker.
- When you change a threshold (up or down), update the baseline comment
  directly above `thresholds` in `vitest.config.mts` with the new date and
  the measured numbers you based it on. Measure with `pnpm test:coverage`
  locally (or read the numbers from the CI job's coverage summary) - never
  guess a number.
- Floors are set a couple of points below the measured number, as a buffer
  against normal run-to-run noise, not as a target to write down to.
