#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const GLOBAL_TEST_CONFIG_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'vitest.config.mts',
  'tsconfig.json',
  'tsconfig.test.json',
  'src/test/setup.ts',
]);

const CODE_FILE_RE = /^(?:src|scripts|\.storybook)\/.*\.[cm]?[jt]sx?$/i;

export function selectVitestRelatedTargets(
  changedPaths = [],
  { detectGlobalConfig = false } = {}
) {
  const normalized = changedPaths
    .map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim())
    .filter(Boolean);

  if (detectGlobalConfig) {
    const touchedGlobal = normalized.some((p) =>
      GLOBAL_TEST_CONFIG_FILES.has(p)
    );
    if (touchedGlobal) {
      return { runAll: true, targets: [] };
    }
  }

  const targets = normalized.filter((p) => CODE_FILE_RE.test(p));
  return detectGlobalConfig ? { runAll: false, targets } : targets;
}

function resolveChangedFilesSinceBase() {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', 'origin/develop...HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    try {
      const out = execFileSync(
        'git',
        ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD~1...HEAD'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      return out.split(/\r?\n/).filter(Boolean);
    } catch {
      return [];
    }
  }
}

function main() {
  const changed = resolveChangedFilesSinceBase().filter((f) =>
    fs.existsSync(f)
  );
  const selection = selectVitestRelatedTargets(changed, {
    detectGlobalConfig: true,
  });

  if (selection.runAll) {
    const res = spawnSync('pnpm', ['vitest', 'run'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    process.exit(res.status ?? 1);
  }

  if (selection.targets.length === 0) {
    console.log(
      '[pre-push] No testable source/script files changed relative to origin/develop; skipping vitest.'
    );
    return;
  }

  const res = spawnSync(
    'pnpm',
    ['vitest', 'related', ...selection.targets, '--run', '--passWithNoTests'],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );
  process.exit(res.status ?? 1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
