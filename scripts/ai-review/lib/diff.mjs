import { execFileSync } from 'node:child_process';

const EXCLUDE_PATHSPECS = [
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)package-lock.json',
  ':(exclude)yarn.lock',
  ':(exclude)*.snap',
  ':(exclude)public/**',
];

export const MAX_DIFF_CHARS = 120000;

/**
 * Classifies a repo-relative path into priority tiers so core application
 * code (`src/**`) is always placed at the front of the unified diff and never
 * truncated behind verbose E2E specs, Storybook files, or unit tests:
 *   0 — Core production code under `src/**` (non-test, non-story)
 *   1 — Config, scripts, workflows, and other non-test repo files
 *   2 — Unit/integration tests and Storybook stories (`*.test.*`, `*.stories.*`)
 *   3 — Playwright E2E specs (`e2e/**`)
 */
export function classifyDiffFilePriority(filePath = '') {
  const normalized = String(filePath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith('e2e/')) {
    return 3;
  }
  if (
    /\.(test|spec|stories)\.[cm]?[jt]sx?$/i.test(normalized) ||
    /(^|\/)(__tests__|__mocks__)\//.test(normalized)
  ) {
    return 2;
  }
  if (normalized.startsWith('src/')) {
    return 0;
  }
  return 1;
}

/**
 * Splits a multi-file `git diff` string on `diff --git` boundaries and stably
 * reorders sections by `classifyDiffFilePriority`, preserving original file
 * order within each priority tier.
 */
export function prioritizeUnifiedDiff(rawDiff) {
  if (!rawDiff || !rawDiff.includes('diff --git ')) {
    return rawDiff;
  }

  const parts = rawDiff.split(/(?=^diff --git )/m);
  if (parts.length <= 1) {
    return rawDiff;
  }

  let preamble = '';
  const fileChunks = [];
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (i === 0 && !chunk.startsWith('diff --git ')) {
      preamble = chunk;
      continue;
    }
    const headerMatch = chunk.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
    const targetPath = headerMatch ? headerMatch[2] : '';
    fileChunks.push({
      chunk,
      priority: classifyDiffFilePriority(targetPath),
      index: i,
    });
  }

  fileChunks.sort((a, b) => a.priority - b.priority || a.index - b.index);
  return preamble + fileChunks.map((item) => item.chunk).join('');
}

function formatCappedDiff(raw) {
  const ordered = prioritizeUnifiedDiff(raw);
  if (ordered.length <= MAX_DIFF_CHARS) {
    return { diff: ordered, truncated: false };
  }

  return {
    diff: `${ordered.slice(0, MAX_DIFF_CHARS)}\n\n... (diff truncated, ${ordered.length} chars total)`,
    truncated: true,
  };
}

/**
 * Returns the unified diff between baseRef and headRef, excluding lockfiles
 * and generated/static assets, prioritized with production `src/**` first and
 * truncated only if exceeding MAX_DIFF_CHARS.
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

  return formatCappedDiff(raw);
}

/**
 * Returns the working-tree unified diff against `baseRef` using the exact same
 * pathspec exclusions, priority ordering, and `MAX_DIFF_CHARS` budget as PR CI.
 */
export function getWorkingTreeDiff(baseRef = 'origin/develop') {
  const args = ['diff', baseRef, '--', '.', ...EXCLUDE_PATHSPECS];
  const raw = execFileSync('git', args, {
    maxBuffer: 1024 * 1024 * 50,
    encoding: 'utf-8',
  });

  return formatCappedDiff(raw);
}
