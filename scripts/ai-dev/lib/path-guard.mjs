import { basename, resolve, sep } from 'node:path';

const REPO_ROOT = process.cwd();

// Substring/prefix checks below all run against POSIX-normalized paths, so a
// single blocklist works regardless of whether the path came in with `\` (Windows)
// or `/` (everywhere else).
const BLOCKED_PREFIXES = [
  '.git/',
  'node_modules/',
  '.env',
  '.github/',
  '.husky/',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
];

// Anything the orchestrator's own tooling (eslint/vitest/husky, all invoked
// automatically every iteration, before a human ever looks at the diff)
// auto-loads and executes as code — overwriting one of these is effectively
// arbitrary code execution on the developer's machine, not just a file edit.
// `.env.example` is a tracked, secret-free template — legitimate feature
// work often needs to document a new env var there (this PR did exactly
// that). Every other `.env*` variant may hold real secrets and stays
// blocked via BLOCKED_PREFIXES below.
const ALLOWED_EXACT_EXCEPTIONS = new Set(['.env.example']);

const BLOCKED_EXACT = new Set([
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  '.npmrc',
  '.nvmrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'vitest.config.mts',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'playwright.config.ts',
  'postcss.config.js',
  'tailwind.config.js',
  'prettier.config.js',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'sentry.edge.config.ts',
  'sentry.server.config.ts',
  'sentry.client.config.ts',
]);

// ESLint (and Prettier's JS config format) cascade: a config file found in
// ANY ancestor directory of a linted file gets require()'d and executed,
// not just one at the repo root. BLOCKED_EXACT above only stops the
// root-level copy — `src/components/.eslintrc.js` would sail straight
// through and then get auto-executed the next time `checks.mjs` force-runs
// eslint, with no human ever having reviewed the diff first. Block these by
// basename, at any depth.
const BLOCKED_BASENAMES = new Set([
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'prettier.config.js',
  '.prettierrc.js',
]);

export class PathGuardError extends Error {}

/** Converts any path (Windows `\` or POSIX `/`) to a forward-slash form for comparison. */
export function normalizePath(inputPath) {
  return String(inputPath).replace(/\\/g, '/');
}

function relativePosixPath(inputPath) {
  const absolute = resolve(REPO_ROOT, inputPath);
  const rootWithSep = REPO_ROOT.endsWith(sep) ? REPO_ROOT : REPO_ROOT + sep;

  if (absolute !== REPO_ROOT && !absolute.startsWith(rootWithSep)) {
    throw new PathGuardError(
      `Path "${inputPath}" resolves outside the repository root — refused.`
    );
  }

  const rel = absolute.slice(REPO_ROOT.length).replace(/^[/\\]/, '');
  return normalizePath(rel);
}

/**
 * Resolves a tool-supplied path against the repo root, rejects anything that
 * escapes the root (`../../etc/passwd`, `~/.ssh/...`) or hits a blocklisted
 * file — sensitive config, lockfiles, and package.json (dependency changes
 * are out of scope for v1, see README). Every tool that touches the filesystem
 * must go through this before doing anything with the path.
 */
export function guardPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathGuardError('Path must be a non-empty string.');
  }

  const relPosix = relativePosixPath(inputPath);
  // Windows and macOS default filesystems are case-insensitive, so
  // `Package.json` or `.GIT/hooks/pre-commit` would land on the exact same
  // file as the lowercase blocklist entry — compare case-folded, but keep
  // the original-case relPosix for the actual filesystem operation.
  const matchPath = relPosix.toLowerCase();

  if (ALLOWED_EXACT_EXCEPTIONS.has(matchPath)) {
    return {
      absolutePath: resolve(REPO_ROOT, relPosix),
      relativePath: relPosix,
    };
  }

  if (BLOCKED_EXACT.has(matchPath)) {
    throw new PathGuardError(
      `"${relPosix}" is not editable by ai:dev (blocked file) — v1 does not support dependency or config changes.`
    );
  }

  if (BLOCKED_BASENAMES.has(basename(matchPath))) {
    throw new PathGuardError(
      `"${relPosix}" is not editable by ai:dev (blocked file — auto-loaded tool config, blocked at any directory depth).`
    );
  }

  for (const prefix of BLOCKED_PREFIXES) {
    if (
      matchPath === prefix.replace(/\/$/, '') ||
      matchPath.startsWith(prefix)
    ) {
      throw new PathGuardError(
        `"${relPosix}" is not editable by ai:dev (blocked path) — matches "${prefix}".`
      );
    }
  }

  return {
    absolutePath: resolve(REPO_ROOT, relPosix),
    relativePath: relPosix,
  };
}
