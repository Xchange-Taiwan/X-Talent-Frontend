#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const DOCS_OR_META_PATTERNS = [
  /\.md$/i,
  /^docs\//,
  /^\.vscode\//,
  /^\.gemini\//,
  /^\.lavish\//,
  /^LICENSE$/i,
];

const STORYBOOK_PATTERNS = [
  /^\.storybook\//,
  /\.stories\.[cm]?[jt]sx?$/i,
  /\.mdx$/i,
];

const NON_BUNDLE_PATTERNS = [
  ...DOCS_OR_META_PATTERNS,
  ...STORYBOOK_PATTERNS,
  /^e2e\//,
  /^\.github\//,
  /^\.agents\//,
  /^\.husky\//,
  /^playwright\.config\./,
  /^vitest\.config\./,
  /^tsconfig\.test\.json$/,
  /\.(?:test|spec)\.[cm]?[jt]sx?$/i,
];

const NON_TEST_PATTERNS = [
  ...DOCS_OR_META_PATTERNS,
  /^e2e\//,
  /^playwright\.config\./,
  /^public\//,
];

export function classifyChangedCiPaths(filePaths = []) {
  const normalized = filePaths
    .map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return {
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: true,
    };
  }

  const docsOnly = normalized.every((f) =>
    DOCS_OR_META_PATTERNS.some((re) => re.test(f))
  );
  const needsBuild = normalized.some(
    (f) => !NON_BUNDLE_PATTERNS.some((re) => re.test(f))
  );
  const needsTests = normalized.some(
    (f) => !NON_TEST_PATTERNS.some((re) => re.test(f))
  );
  const needsStorybookBuild = normalized.some((f) =>
    STORYBOOK_PATTERNS.some((re) => re.test(f))
  );

  return {
    docsOnly,
    needsBuild,
    needsTests,
    needsStorybookBuild,
  };
}

function getDiffFiles(baseRef) {
  const cleanBase = String(baseRef || 'develop').trim();
  if (
    !cleanBase ||
    cleanBase.startsWith('-') ||
    !/^[A-Za-z0-9._/-]+$/.test(cleanBase)
  ) {
    throw new Error(`Invalid base branch ref: ${cleanBase}`);
  }
  try {
    execFileSync(
      'git',
      ['rev-parse', '--verify', `refs/remotes/origin/${cleanBase}`],
      { stdio: 'ignore' }
    );
  } catch {
    execFileSync('git', ['fetch', 'origin', '--', cleanBase], {
      stdio: 'ignore',
    });
  }
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `origin/${cleanBase}...HEAD`],
    { encoding: 'utf8' }
  );
  return out.split(/\r?\n/).filter(Boolean);
}

function main() {
  const baseIdx = process.argv.indexOf('--base');
  const baseRef = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'develop';

  let result;
  try {
    const files = getDiffFiles(baseRef);
    result = classifyChangedCiPaths(files);
  } catch {
    result = {
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: true,
    };
  }

  if (process.env.GITHUB_OUTPUT) {
    const lines = [
      `docs_only=${result.docsOnly ? 'true' : 'false'}`,
      `needs_build=${result.needsBuild ? 'true' : 'false'}`,
      `needs_tests=${result.needsTests ? 'true' : 'false'}`,
      `needs_storybook_build=${result.needsStorybookBuild ? 'true' : 'false'}`,
    ];
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${lines.join('\n')}\n`,
      'utf8'
    );
  }

  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
