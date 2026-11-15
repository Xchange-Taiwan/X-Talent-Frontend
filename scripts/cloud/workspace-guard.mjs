import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createDefaultCommandPort,
  redactCredentials,
} from '../../.agents/scripts/tracker-ops.mjs';

const NUL = String.fromCharCode(0);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BS = String.fromCharCode(92);

export const DEFAULT_DEV_API_URL =
  'https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/api';

export const HEADLESS_EXCLUDED_TOOLS = Object.freeze([
  'run_shell_command',
  'web_fetch',
  'google_web_search',
]);

export const WORKSPACE_LOCKED_FILES = Object.freeze([
  '.gitignore',
  '.gemini/settings.json',
]);

const RIPGREP_VERSION = '14.1.1';
const RIPGREP_SHA256 =
  '4cf9f2741e6c465ffdb7c26f38056a59e2a2544b51f7cc128ef28337eeae4d8e';
const RIPGREP_TAR_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`;

const OPTIONAL_PASSTHROUGH_ENV_KEYS = Object.freeze([
  'BFF_OPENAPI_URL',
  'SENTRY_DSN',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
]);

function splitLines(raw = '') {
  return String(raw ?? '')
    .replaceAll(CR, '')
    .split(LF);
}

function sanitizeEnvValue(raw = '') {
  return String(raw ?? '')
    .replaceAll(CR, '')
    .replaceAll(LF, '');
}

function normalizeSlashes(raw = '') {
  return String(raw ?? '')
    .split(BS)
    .join('/');
}

function resolveGitRunner({
  cwd = process.cwd(),
  env = process.env,
  gitEnv,
  port,
  execGit,
} = {}) {
  const effectiveEnv = gitEnv || env;
  if (port && typeof port.git === 'function') {
    return (args) => String(port.git(args, { cwd, env: effectiveEnv }) ?? '');
  }
  if (typeof execGit === 'function') {
    return (args, { capture = false } = {}) => {
      const res = execGit('git', args, {
        cwd,
        env: effectiveEnv,
        ...(capture
          ? { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
          : { stdio: 'ignore' }),
      });
      return String(res ?? '');
    };
  }
  const defaultPort = createDefaultCommandPort({
    repoRoot: cwd,
    env: effectiveEnv,
  });
  return (args) =>
    String(defaultPort.git(args, { cwd, env: effectiveEnv }) ?? '');
}

export function isSecretEnvFile(filePath = '') {
  const norm = normalizeSlashes(filePath).trim();
  if (!norm) return false;
  return (
    /(^|\/)\.env(\..+)?$/.test(norm) &&
    !/\.env\.(example|sample|template)$/i.test(norm)
  );
}

export function resolveCloudApiUrl(env = process.env) {
  let resolvedApiUrl =
    String(env?.NEXT_PUBLIC_API_URL || '').trim() || DEFAULT_DEV_API_URL;
  const rawBffUrl = String(env?.BFF_OPENAPI_URL || '').trim();
  if (rawBffUrl) {
    let derived = rawBffUrl.replace(/\/openapi\.json$/, '');
    if (!derived.endsWith('/api')) {
      derived = `${derived.replace(/\/+$/, '')}/api`;
    }
    resolvedApiUrl = derived;
  }
  return resolvedApiUrl;
}

export function mergeHeadlessGeminiSettings(
  settingsPath = '.gemini/settings.json',
  fsImpl = fs
) {
  if (!fsImpl.existsSync(settingsPath)) return false;
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(settingsPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }
    const nextConfig = { ...parsed };
    delete nextConfig.mcpServers;
    delete nextConfig.hooks;

    const existing = Array.isArray(nextConfig?.tools?.exclude)
      ? nextConfig.tools.exclude
      : [];
    const mergedExclude = [
      ...new Set([...existing, ...HEADLESS_EXCLUDED_TOOLS]),
    ];

    const prevFiltering =
      nextConfig.fileFiltering && typeof nextConfig.fileFiltering === 'object'
        ? nextConfig.fileFiltering
        : {};
    const prevContext =
      nextConfig.context && typeof nextConfig.context === 'object'
        ? nextConfig.context
        : {};
    const prevCtxFiltering =
      prevContext.fileFiltering && typeof prevContext.fileFiltering === 'object'
        ? prevContext.fileFiltering
        : {};

    const updated = {
      ...nextConfig,
      tools: {
        ...(nextConfig.tools && typeof nextConfig.tools === 'object'
          ? nextConfig.tools
          : {}),
        exclude: mergedExclude,
      },
      fileFiltering: {
        ...prevFiltering,
        respectGitIgnore: true,
        respectGeminiIgnore: false,
      },
      context: {
        ...prevContext,
        fileFiltering: {
          ...prevCtxFiltering,
          respectGitIgnore: true,
          respectGeminiIgnore: false,
        },
      },
    };
    fsImpl.writeFileSync(
      settingsPath,
      `${JSON.stringify(updated, null, 2)}${LF}`,
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}

export function applyHeadlessWorkspaceLocks({
  cwd = process.cwd(),
  env = process.env,
  fsImpl = fs,
  port,
  execGit,
} = {}) {
  const runGit = resolveGitRunner({ cwd, env, port, execGit });
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fsImpl.existsSync(gitignorePath)) {
    try {
      const giRaw = fsImpl.readFileSync(gitignorePath, 'utf8');
      const giFiltered = splitLines(giRaw)
        .filter((line) => line.trim() !== '/.agents/tmp/')
        .join(LF);
      if (giFiltered !== giRaw) {
        fsImpl.writeFileSync(gitignorePath, giFiltered, 'utf8');
      }
      runGit(['update-index', '--skip-worktree', '.gitignore']);
    } catch {}
  }

  const settingsPath = path.join(cwd, '.gemini', 'settings.json');
  if (mergeHeadlessGeminiSettings(settingsPath, fsImpl)) {
    try {
      runGit(['update-index', '--skip-worktree', '.gemini/settings.json']);
    } catch {}
  }
}

export function unstageCloudWorkspaceLocks({
  cwd = process.cwd(),
  env = process.env,
  gitEnv,
  port,
  execGit,
  restoreWorktree = false,
  includeWorkspaceLocks = true,
} = {}) {
  const runGit = resolveGitRunner({ cwd, env, gitEnv, port, execGit });
  const unstaged = [];

  if (restoreWorktree && includeWorkspaceLocks) {
    for (const lockedFile of WORKSPACE_LOCKED_FILES) {
      try {
        runGit(['update-index', '--no-skip-worktree', lockedFile]);
      } catch {}
    }
  }

  try {
    const cachedNames = splitLines(
      runGit(['diff', '--cached', '--name-only'], { capture: true })
    )
      .map((s) => s.trim())
      .filter(Boolean);

    for (const filePath of cachedNames) {
      if (isSecretEnvFile(filePath)) {
        try {
          runGit(['reset', '--', filePath]);
          unstaged.push(filePath);
        } catch {}
      }
    }
  } catch {}

  const resetSpecs = includeWorkspaceLocks
    ? ['.agents/tmp*', ...WORKSPACE_LOCKED_FILES]
    : ['.agents/tmp*'];

  for (const spec of resetSpecs) {
    try {
      runGit(['reset', '--', spec]);
    } catch {}
  }

  if (restoreWorktree && includeWorkspaceLocks) {
    for (const lockedFile of WORKSPACE_LOCKED_FILES) {
      try {
        runGit(['checkout', 'HEAD', '--', lockedFile]);
      } catch {}
    }
  }

  return { unstaged };
}

export function applyDeleteFilesManifest(
  optionsOrRoot = {},
  maybeLog = undefined,
  maybeFs = undefined
) {
  const isLegacyPositional =
    typeof optionsOrRoot === 'string' || typeof maybeLog === 'function';
  const opts = isLegacyPositional
    ? {
        cwd: optionsOrRoot || process.cwd(),
        log: maybeLog,
        fsImpl: maybeFs,
      }
    : optionsOrRoot || {};

  const repoRoot = path.resolve(opts.cwd || opts.repoRoot || process.cwd());
  const fsImpl = opts.fsImpl || fs;
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const manifestRelPath =
    opts.manifestRelPath || '.agents/tmp/delete-files.txt';
  const manifestPath = path.join(repoRoot, manifestRelPath);

  const deleted = [];
  const skipped = [];

  if (!fsImpl.existsSync(manifestPath)) {
    return { deleted, skipped };
  }

  let rawContent = '';
  try {
    const manifestStat = fsImpl.lstatSync(manifestPath);
    if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
      try {
        fsImpl.unlinkSync(manifestPath);
      } catch {}
      return { deleted, skipped };
    }
    rawContent = fsImpl.readFileSync(manifestPath, 'utf8');
  } catch (err) {
    const msg = err?.message || err;
    log(`[workspace-guard] Failed to read delete-files.txt: ${msg}`);
    try {
      fsImpl.unlinkSync(manifestPath);
    } catch {}
    return { deleted, skipped };
  }

  try {
    const lines = splitLines(rawContent)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const rawLine of lines) {
      const isUnsafePath =
        rawLine.includes(NUL) ||
        path.isAbsolute(rawLine) ||
        rawLine.startsWith('/') ||
        rawLine.startsWith(BS) ||
        /^[a-zA-Z]:/.test(rawLine);
      if (isUnsafePath) {
        log(`[workspace-guard] Skipping unsafe delete entry: ${rawLine}`);
        skipped.push(rawLine);
        continue;
      }

      const relPath = normalizeSlashes(rawLine).replace(/^\.\//, '');
      const segments = relPath.split('/');
      const hasForbiddenSegment = segments.some(
        (seg) =>
          !seg ||
          seg === '.' ||
          seg === '..' ||
          seg === '.git' ||
          seg === '.agents' ||
          seg === '.gemini' ||
          seg === '.gitignore' ||
          seg.startsWith('.env')
      );
      if (!relPath || relPath === '.gitignore' || hasForbiddenSegment) {
        log(`[workspace-guard] Skipping forbidden delete entry: ${rawLine}`);
        skipped.push(rawLine);
        continue;
      }

      const resolvedPath = path.resolve(repoRoot, relPath);
      const relFromRoot = path.relative(repoRoot, resolvedPath);
      const isOutsideRoot =
        !relFromRoot ||
        relFromRoot.startsWith('..') ||
        path.isAbsolute(relFromRoot);
      if (isOutsideRoot) {
        log(`[workspace-guard] Skipping out-of-repo delete entry: ${rawLine}`);
        skipped.push(rawLine);
        continue;
      }

      try {
        let hasInvalidParent = false;
        let walkDir = repoRoot;
        for (let i = 0; i < segments.length - 1; i++) {
          walkDir = path.join(walkDir, segments[i]);
          const dirStat = fsImpl.lstatSync(walkDir);
          if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
            hasInvalidParent = true;
            break;
          }
        }
        if (hasInvalidParent) {
          log(`[workspace-guard] Skipping symlink-parent entry: ${relPath}`);
          skipped.push(rawLine);
          continue;
        }

        const targetStat = fsImpl.lstatSync(resolvedPath);
        if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
          log(
            `[workspace-guard] Skipping non-file/symlink delete entry: ${relPath}`
          );
          skipped.push(rawLine);
          continue;
        }

        fsImpl.unlinkSync(resolvedPath);
        deleted.push(relPath);
        log(`[workspace-guard] Deleted file via manifest: ${relPath}`);
      } catch (err) {
        if (err?.code === 'ENOENT') {
          continue;
        }
        const msg = err?.message || err;
        log(`[workspace-guard] Failed to delete ${relPath}: ${msg}`);
        skipped.push(rawLine);
      }
    }
  } finally {
    try {
      fsImpl.unlinkSync(manifestPath);
    } catch {}
  }

  return { deleted, skipped };
}

export function cleanupCloudTempFiles({
  cwd = process.cwd(),
  fsImpl = fs,
  removeAgentsTmp = false,
} = {}) {
  for (const relFile of [
    '.env.development.local',
    '.env.e2e.local',
    '.gemini/settings.json.tmp',
  ]) {
    try {
      fsImpl.rmSync(path.join(cwd, relFile), { force: true });
    } catch {}
  }
  if (removeAgentsTmp) {
    try {
      fsImpl.rmSync(path.join(cwd, '.agents/tmp'), {
        recursive: true,
        force: true,
      });
    } catch {}
  }
}

function updateGitInfoExclude(cwd, fsImpl) {
  const gitDirPath = path.join(cwd, '.git');
  if (!fsImpl.existsSync(gitDirPath)) return;
  try {
    const infoDir = path.join(gitDirPath, 'info');
    fsImpl.mkdirSync(infoDir, { recursive: true });
    const excludePath = path.join(infoDir, 'exclude');
    const existing = fsImpl.existsSync(excludePath)
      ? fsImpl.readFileSync(excludePath, 'utf8')
      : '';
    const existingLines = new Set(
      splitLines(existing).map((line) => line.trim())
    );
    const additions = [
      '.env.development.local',
      '.env.e2e.local',
      '.env*.local',
    ].filter((entry) => !existingLines.has(entry));
    if (additions.length > 0) {
      const prefix = existing && !existing.endsWith(LF) ? LF : '';
      fsImpl.writeFileSync(
        excludePath,
        `${existing}${prefix}${additions.join(LF)}${LF}`,
        'utf8'
      );
    }
  } catch {}
}

function writePreCommitHook(cwd, fsImpl) {
  const gitDirPath = path.join(cwd, '.git');
  if (!fsImpl.existsSync(gitDirPath)) return;
  try {
    const hooksDir = path.join(gitDirPath, 'hooks');
    fsImpl.mkdirSync(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, 'pre-commit');
    const hookContent = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'exec node "$(git rev-parse --show-toplevel)/scripts/cloud/workspace-guard.mjs" pre-commit-check "$@"',
      '',
    ].join(LF);
    fsImpl.writeFileSync(hookPath, hookContent, 'utf8');
    try {
      fsImpl.chmodSync(hookPath, 0o755);
    } catch {}
  } catch {}
}

async function ensureRipgrepOnLinux({
  fetchImpl = fetch,
  fsImpl = fs,
  execImpl = execFileSync,
} = {}) {
  if (process.platform !== 'linux' || process.arch !== 'x64') return false;
  try {
    execImpl('which', ['rg'], { stdio: 'ignore' });
    return false;
  } catch {}

  const tmpDir = fsImpl.mkdtempSync(path.join(os.tmpdir(), 'rg-cloud-'));
  const tarPath = path.join(tmpDir, 'rg.tar.gz');
  try {
    const res = await fetchImpl(RIPGREP_TAR_URL, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = crypto.createHash('sha256').update(buf).digest('hex');
    if (digest !== RIPGREP_SHA256) {
      return false;
    }
    fsImpl.writeFileSync(tarPath, buf);
    execImpl('tar', ['-xzf', tarPath, '-C', tmpDir], { stdio: 'ignore' });
    const extractedBin = path.join(
      tmpDir,
      `ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl`,
      'rg'
    );
    try {
      fsImpl.copyFileSync(extractedBin, '/usr/local/bin/rg');
      fsImpl.chmodSync('/usr/local/bin/rg', 0o755);
    } catch {
      execImpl(
        'sudo',
        ['install', '-m', '0755', extractedBin, '/usr/local/bin/rg'],
        { stdio: 'ignore' }
      );
    }
    return true;
  } catch {
    return false;
  } finally {
    try {
      fsImpl.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

function readExistingEnvMap(filePath, fsImpl = fs) {
  const map = {};
  if (!filePath) return map;
  try {
    if (!fsImpl.existsSync(filePath)) return map;
    const raw = fsImpl.readFileSync(filePath, 'utf8');
    for (const line of splitLines(raw)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = sanitizeEnvValue(trimmed.slice(eqIdx + 1));
      if (key && val) {
        map[key] = val;
      }
    }
  } catch {}
  return map;
}

export async function setupCloudEnvironment(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const env = options.env || process.env;
  const fsImpl = options.fsImpl || fs;
  const hasCustomPort = Boolean(options.port || options.execGit);
  const runGit = resolveGitRunner({
    cwd,
    env,
    port: options.port,
    execGit: options.execGit,
  });

  const authorName =
    sanitizeEnvValue(env.GIT_AUTHOR_NAME) || 'x-talent-cloud-agent[bot]';
  const authorEmail =
    sanitizeEnvValue(env.GIT_AUTHOR_EMAIL) ||
    'x-talent-cloud-agent[bot]@users.noreply.github.com';

  try {
    runGit(['config', 'user.name', authorName]);
    runGit(['config', 'user.email', authorEmail]);
  } catch {}

  const devEnvPath = path.join(cwd, '.env.development.local');
  const e2eEnvPath = path.join(cwd, '.env.e2e.local');
  const existingEnv = {
    ...readExistingEnvMap(e2eEnvPath, fsImpl),
    ...readExistingEnvMap(devEnvPath, fsImpl),
  };
  if (
    sanitizeEnvValue(env?.NEXT_PUBLIC_API_URL) &&
    !sanitizeEnvValue(env?.BFF_OPENAPI_URL)
  ) {
    delete existingEnv.BFF_OPENAPI_URL;
  }
  const pickEnv = (key) => {
    const direct = sanitizeEnvValue(env?.[key]);
    if (direct) return direct;
    return sanitizeEnvValue(existingEnv[key]);
  };

  const hasExplicitApiEnv = Boolean(
    sanitizeEnvValue(env?.BFF_OPENAPI_URL) ||
    sanitizeEnvValue(env?.NEXT_PUBLIC_API_URL)
  );
  const resolvedApiUrl = resolveCloudApiUrl(
    hasExplicitApiEnv ? env : existingEnv
  );
  const nextAuthUrl = pickEnv('NEXTAUTH_URL') || 'http://localhost:3000';
  const nextAuthSecret = pickEnv('NEXTAUTH_SECRET');
  const geminiApiKey = pickEnv('GEMINI_API_KEY');
  const mentorEmail = sanitizeEnvValue(
    env.DESIGN_AUDIT_MENTOR_EMAIL ||
      env.E2E_MENTOR_EMAIL ||
      existingEnv.DESIGN_AUDIT_MENTOR_EMAIL ||
      existingEnv.E2E_MENTOR_EMAIL
  );
  const mentorPassword = sanitizeEnvValue(
    env.DESIGN_AUDIT_MENTOR_PASSWORD ||
      env.E2E_MENTOR_PASSWORD ||
      existingEnv.DESIGN_AUDIT_MENTOR_PASSWORD ||
      existingEnv.E2E_MENTOR_PASSWORD
  );
  const menteeEmail = sanitizeEnvValue(
    env.DESIGN_AUDIT_MENTEE_EMAIL ||
      env.E2E_MENTEE_EMAIL ||
      existingEnv.DESIGN_AUDIT_MENTEE_EMAIL ||
      existingEnv.E2E_MENTEE_EMAIL
  );
  const menteePassword = sanitizeEnvValue(
    env.DESIGN_AUDIT_MENTEE_PASSWORD ||
      env.E2E_MENTEE_PASSWORD ||
      existingEnv.DESIGN_AUDIT_MENTEE_PASSWORD ||
      existingEnv.E2E_MENTEE_PASSWORD
  );
  const e2eMentorEmail = sanitizeEnvValue(
    env.E2E_MENTOR_EMAIL ||
      env.DESIGN_AUDIT_MENTOR_EMAIL ||
      existingEnv.E2E_MENTOR_EMAIL ||
      existingEnv.DESIGN_AUDIT_MENTOR_EMAIL
  );
  const e2eMentorPassword = sanitizeEnvValue(
    env.E2E_MENTOR_PASSWORD ||
      env.DESIGN_AUDIT_MENTOR_PASSWORD ||
      existingEnv.E2E_MENTOR_PASSWORD ||
      existingEnv.DESIGN_AUDIT_MENTOR_PASSWORD
  );
  const e2eMenteeEmail = sanitizeEnvValue(
    env.E2E_MENTEE_EMAIL ||
      env.DESIGN_AUDIT_MENTEE_EMAIL ||
      existingEnv.E2E_MENTEE_EMAIL ||
      existingEnv.DESIGN_AUDIT_MENTEE_EMAIL
  );
  const e2eMenteePassword = sanitizeEnvValue(
    env.E2E_MENTEE_PASSWORD ||
      env.DESIGN_AUDIT_MENTEE_PASSWORD ||
      existingEnv.E2E_MENTEE_PASSWORD ||
      existingEnv.DESIGN_AUDIT_MENTEE_PASSWORD
  );

  const devEnvLines = [
    `NEXT_PUBLIC_API_URL=${resolvedApiUrl}`,
    `NEXTAUTH_URL=${nextAuthUrl}`,
    `NEXTAUTH_SECRET=${nextAuthSecret}`,
    `GEMINI_API_KEY=${geminiApiKey}`,
    `DESIGN_AUDIT_MENTOR_EMAIL=${mentorEmail}`,
    `DESIGN_AUDIT_MENTOR_PASSWORD=${mentorPassword}`,
    `DESIGN_AUDIT_MENTEE_EMAIL=${menteeEmail}`,
    `DESIGN_AUDIT_MENTEE_PASSWORD=${menteePassword}`,
  ];

  for (const key of OPTIONAL_PASSTHROUGH_ENV_KEYS) {
    const val = pickEnv(key);
    if (val) {
      devEnvLines.push(`${key}=${val}`);
    }
  }

  fsImpl.writeFileSync(devEnvPath, `${devEnvLines.join(LF)}${LF}`, 'utf8');
  try {
    fsImpl.chmodSync(devEnvPath, 0o600);
  } catch {}

  const e2eEnvLines = [
    `NEXT_PUBLIC_API_URL=${resolvedApiUrl}`,
    `NEXTAUTH_SECRET=${nextAuthSecret}`,
    `E2E_MENTOR_EMAIL=${e2eMentorEmail}`,
    `E2E_MENTOR_PASSWORD=${e2eMentorPassword}`,
    `E2E_MENTEE_EMAIL=${e2eMenteeEmail}`,
    `E2E_MENTEE_PASSWORD=${e2eMenteePassword}`,
  ];

  fsImpl.writeFileSync(e2eEnvPath, `${e2eEnvLines.join(LF)}${LF}`, 'utf8');
  try {
    fsImpl.chmodSync(e2eEnvPath, 0o600);
  } catch {}

  applyHeadlessWorkspaceLocks({
    cwd,
    env,
    fsImpl,
    port: options.port,
    execGit: options.execGit,
  });

  const shouldInstallRg =
    options.installRipgrep !== undefined
      ? Boolean(options.installRipgrep)
      : !hasCustomPort;
  if (shouldInstallRg) {
    await ensureRipgrepOnLinux({
      fetchImpl: options.fetchImpl || fetch,
      fsImpl,
      execImpl: options.execImpl || execFileSync,
    });
  }

  updateGitInfoExclude(cwd, fsImpl);
  writePreCommitHook(cwd, fsImpl);

  return {
    resolvedApiUrl,
    devEnvPath,
    e2eEnvPath,
  };
}

export function runPreCommitSecretGuard({
  cwd = process.cwd(),
  env = process.env,
  port,
  execGit,
} = {}) {
  const runGit = resolveGitRunner({ cwd, env, port, execGit });
  let cachedNames = [];
  try {
    cachedNames = splitLines(
      runGit(['diff', '--cached', '--name-only'], { capture: true })
    )
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return { blocked: false, stagedSecrets: [] };
  }

  const stagedSecrets = cachedNames.filter((filePath) =>
    isSecretEnvFile(filePath)
  );
  if (stagedSecrets.length > 0) {
    unstageCloudWorkspaceLocks({ cwd, env, port, execGit });
    return { blocked: true, stagedSecrets };
  }

  const hasLockedOrTmp = cachedNames.some(
    (filePath) =>
      filePath.startsWith('.agents/tmp/') ||
      filePath === '.agents/tmp' ||
      WORKSPACE_LOCKED_FILES.includes(filePath)
  );
  if (hasLockedOrTmp) {
    unstageCloudWorkspaceLocks({ cwd, env, port, execGit });
  }

  return { blocked: false, stagedSecrets: [] };
}

export async function runWorkspaceGuardCli(
  argv = process.argv.slice(2),
  options = {}
) {
  const subcommand = String(argv[0] || '').trim();
  const restArgs = argv.slice(1);

  if (subcommand === 'setup') {
    await setupCloudEnvironment(options);
    return { exitCode: 0 };
  }

  if (subcommand === 'unstage') {
    const restoreWorktree = restArgs.includes('--restore-worktree');
    unstageCloudWorkspaceLocks({ ...options, restoreWorktree });
    return { exitCode: 0 };
  }

  if (subcommand === 'apply-deletes') {
    const log = options.log || ((msg) => console.log(msg));
    applyDeleteFilesManifest({ ...options, log });
    return { exitCode: 0 };
  }

  if (subcommand === 'pre-commit-check') {
    const res = runPreCommitSecretGuard(options);
    if (res.blocked) {
      const stderr = options.stderr || process.stderr;
      stderr.write(
        `Blocked staging of secret .env files in pre-commit hook.${LF}`
      );
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  }

  throw new Error(
    `Unknown workspace-guard command '${subcommand}'. Expected setup | unstage | apply-deletes | pre-commit-check.`
  );
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runWorkspaceGuardCli(process.argv.slice(2))
    .then(({ exitCode }) => {
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    })
    .catch((err) => {
      const safeMsg = redactCredentials(err?.message || String(err));
      process.stderr.write(`[workspace-guard] Error: ${safeMsg}${LF}`);
      process.exit(1);
    });
}
