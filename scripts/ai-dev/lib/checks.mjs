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

  // `--` terminates option parsing — without it, a file name starting with
  // `-` (e.g. a dev-agent-created "--config=malicious.js") would be parsed
  // as an eslint flag instead of a path (argument injection).
  // `--fix` already reports remaining (non-auto-fixable) errors in its own
  // output and exit code — a second bare `eslint` pass on the same files
  // would just re-lint already-fixed content for the same answer, doubling
  // this step's time every iteration for nothing.
  const { code, stdout, stderr } = await runProcess(
    'pnpm',
    ['exec', 'eslint', '--fix', '--', ...files],
    { timeoutMs: 60_000 }
  );
  // --fix may have rewritten files on disk — re-stage so the WIP commit picks up the fixes.
  stageAll();

  return {
    skipped: false,
    ok: code === 0,
    output: `${stdout}\n${stderr}`.trim(),
  };
}

const TSC_ERROR_LINE = /^(.+?)\(\d+,\d+\): (error TS\d+: .+)$/;

/**
 * Parses tsc output into `{ raw, key }` pairs. `key` deliberately drops the
 * line/column — if the agent inserts a line above a pre-existing error
 * (e.g. a new import), every baseline error below it shifts by one line and
 * would no longer string-match the baseline, getting misclassified as "new"
 * even though it's the same pre-existing issue. Comparing by file+code+message
 * instead survives line shifts; `raw` (with the real line number) is kept
 * for what actually gets shown to the agent.
 */
function parseTypeCheckErrors(output) {
  const errors = [];
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    const match = line.match(TSC_ERROR_LINE);
    if (match) {
      const [, file, rest] = match;
      errors.push({ raw: line, key: `${file}: ${rest}` });
    }
  }
  return errors;
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
  return new Set(
    parseTypeCheckErrors(`${stdout}\n${stderr}`).map((e) => e.key)
  );
}

/** Returns only the error lines that are new since the baseline, regardless of which file they're in. */
export async function diffTypeCheckErrors(baselineSet) {
  const { code, stdout, stderr, timedOut } = await runTypeCheck();
  if (timedOut) {
    return { ok: false, newErrors: ['type-check timed out'] };
  }
  const current = parseTypeCheckErrors(`${stdout}\n${stderr}`);
  const newErrors = current
    .filter((e) => !baselineSet.has(e.key))
    .map((e) => e.raw);
  // tsc exits non-zero whenever ANY error exists, including pre-existing
  // baseline ones — requiring code === 0 would make this permanently fail
  // on any repo that already had type errors before the agent started,
  // even when the agent introduced nothing new. `current.length > 0`
  // confirms the non-zero exit is explained by parseable TS errors (not a
  // tsc crash for some other reason) before treating it as a pass.
  const ok = newErrors.length === 0 && (code === 0 || current.length > 0);
  return { ok, newErrors };
}
