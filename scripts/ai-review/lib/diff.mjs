import { execFileSync } from 'node:child_process';

const EXCLUDE_PATHSPECS = [
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)package-lock.json',
  ':(exclude)yarn.lock',
  ':(exclude)*.snap',
  ':(exclude)public/**',
];

const MAX_DIFF_CHARS = 60000;

/**
 * Returns the unified diff between baseRef and headRef, excluding lockfiles
 * and generated/static assets, truncated to a size the Gemini prompt can
 * afford.
 *
 * Takes headRef as an explicit argument rather than diffing against the
 * checked-out `HEAD` — the calling job checks out the trusted base branch
 * (not the PR head) so that a PR can't get its own modified review scripts
 * executed with secrets, and only fetches the PR head commit as diff input.
 *
 * Uses execFileSync (no shell) rather than execSync — the `:(exclude)...`
 * pathspec magic contains unquoted parens that /bin/sh on the Actions
 * runner fails to parse when the command is built as a shell string.
 */
export function getDiff(baseRef, headRef) {
  const args = [
    'diff',
    `${baseRef}...${headRef}`,
    '--',
    '.',
    ...EXCLUDE_PATHSPECS,
  ];
  const raw = execFileSync('git', args, {
    maxBuffer: 1024 * 1024 * 50,
    encoding: 'utf-8',
  });

  if (raw.length <= MAX_DIFF_CHARS) {
    return { diff: raw, truncated: false };
  }

  return {
    diff: `${raw.slice(0, MAX_DIFF_CHARS)}\n\n... (diff truncated, ${raw.length} chars total)`,
    truncated: true,
  };
}
