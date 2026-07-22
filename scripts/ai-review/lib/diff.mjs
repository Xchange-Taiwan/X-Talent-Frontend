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
 * Returns the unified diff between baseRef and HEAD, excluding lockfiles and
 * generated/static assets, truncated to a size the Gemini prompt can afford.
 *
 * Uses execFileSync (no shell) rather than execSync — the `:(exclude)...`
 * pathspec magic contains unquoted parens that /bin/sh on the Actions
 * runner fails to parse when the command is built as a shell string.
 */
export function getDiff(baseRef) {
  const args = ['diff', `${baseRef}...HEAD`, '--', '.', ...EXCLUDE_PATHSPECS];
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
