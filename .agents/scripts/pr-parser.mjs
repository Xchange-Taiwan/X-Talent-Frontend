/**
 * PR Check State Parsing and Timeout helpers for monitor-pr.mjs
 */

export function categorizeChecks(checks = []) {
  const passing = [];
  const pending = [];
  const failing = [];

  for (const check of checks) {
    if (
      check.bucket === 'pass' ||
      check.state === 'success' ||
      check.bucket === 'skipping'
    ) {
      passing.push(check);
    } else if (
      check.bucket === 'pending' ||
      check.state === 'pending' ||
      check.state === 'in_progress' ||
      check.state === 'queued'
    ) {
      pending.push(check);
    } else {
      failing.push(check);
    }
  }

  return { passing, pending, failing };
}

export function isTimeout(startTime, maxTimeout, currentTime = Date.now()) {
  const elapsed = currentTime - startTime;
  return elapsed > maxTimeout;
}
