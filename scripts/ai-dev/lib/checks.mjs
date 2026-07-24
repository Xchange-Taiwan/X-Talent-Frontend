import { readFileSync } from 'node:fs';

import { stageAll, stagedFilesExcludingDeleted } from './git.mjs';
import { runProcess } from './proc.mjs';

export class ChecksError extends Error {}

const REQUIRED_SCRIPTS = ['lint', 'lint:fix', 'type-check', 'build', 'test'];
const LINTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

/** Preflight: fails fast with a clear message if the target repo's package.json is missing a script this tool depends on, instead of letting a later spawn() throw an opaque error. */
export function verifyRequiredScripts() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const missing = REQUIRED_SCRIPTS.filter((name) => !pkg.scripts?.[name]);
  if (missing.length > 0) {
    throw new ChecksError(
      `package.json is missing required script(s): ${missing.join(', ')}`
    );
  }
}

function extensionOf(path) {
  const match = path.match(/\.[^./]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Auto-fixes and lints only the files touched this round. Bypasses the
 * `lint`/`lint:fix` npm scripts on purpose — they hardcode `eslint .`, so
 * appending file paths would still scan the whole project (Round 9).
 */
export async function autoFixAndLintStaged() {
  const files = stagedFilesExcludingDeleted().filter((f) =>
    LINTABLE_EXTENSIONS.has(extensionOf(f))
  );
  if (files.length === 0) {
    return { skipped: true, ok: true, output: '' };
  }

  await runProcess('pnpm', ['exec', 'eslint', '--fix', ...files], {
    timeoutMs: 60_000,
  });
  // --fix may have rewritten files on disk — re-stage so the WIP commit picks up the fixes.
  stageAll();

  const { code, stdout, stderr } = await runProcess(
    'pnpm',
    ['exec', 'eslint', ...files],
    {
      timeoutMs: 60_000,
    }
  );
  return {
    skipped: false,
    ok: code === 0,
    output: `${stdout}\n${stderr}`.trim(),
  };
}

const TSC_ERROR_LINE = /^.+?\(\d+,\d+\): error TS\d+: .+$/;

function parseTypeCheckErrorLines(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => TSC_ERROR_LINE.test(line));
}

async function runTypeCheck() {
  return runProcess('pnpm', ['type-check'], { timeoutMs: 120_000 });
}

/** Captures the pre-existing type-check error set before the agent touches anything, so later rounds can tell "the agent broke this" apart from "this was already broken" — including errors in files the agent never directly edited (Round 10: type errors cascade downstream). */
export async function captureTypeCheckBaseline() {
  const { stdout, stderr, timedOut } = await runTypeCheck();
  if (timedOut) {
    throw new ChecksError('type-check baseline run timed out.');
  }
  return new Set(parseTypeCheckErrorLines(`${stdout}\n${stderr}`));
}

/** Returns only the error lines that are new since the baseline, regardless of which file they're in. */
export async function diffTypeCheckErrors(baselineSet) {
  const { code, stdout, stderr, timedOut } = await runTypeCheck();
  if (timedOut) {
    return { ok: false, newErrors: ['type-check timed out'] };
  }
  const current = parseTypeCheckErrorLines(`${stdout}\n${stderr}`);
  const newErrors = current.filter((line) => !baselineSet.has(line));
  return { ok: code === 0 && newErrors.length === 0, newErrors };
}
