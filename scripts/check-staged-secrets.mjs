#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SECRET_RULES = [
  {
    id: 'private-key-pem',
    label: 'PEM Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'github-pat',
    label: 'GitHub Personal Access / OAuth Token',
    pattern:
      /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,255}\b|\bgithub_pat_[A-Za-z0-9_]{50,255}\b/g,
  },
  {
    id: 'aws-access-key',
    label: 'AWS Access Key ID',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    id: 'google-api-key',
    label: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  },
  {
    id: 'sentry-auth-token',
    label: 'Sentry Auth Token',
    pattern: /\bsntry[su]_[A-Za-z0-9_=-]{24,}\b/g,
  },
  {
    id: 'slack-token',
    label: 'Slack Token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{24,}\b/g,
  },
  {
    id: 'jwt-token',
    label: 'Signed JWT Token',
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{16,}\b/g,
  },
];

const SKIP_EXACT_NAMES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.env.example',
]);

export function shouldSkipSecretScanPath(filePath = '') {
  const normalized = String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized) return true;
  const base = path.posix.basename(normalized);
  if (SKIP_EXACT_NAMES.has(base)) return true;
  if (
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('.next/') ||
    normalized.startsWith('coverage/') ||
    normalized.startsWith('storybook-static/')
  ) {
    return true;
  }
  if (/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/i.test(normalized)) {
    return true;
  }
  if (
    /\.(?:png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|pdf|zip|gz)$/i.test(
      normalized
    )
  ) {
    return true;
  }
  return false;
}

export function redactSecretPreview(rawMatch = '') {
  const str = String(rawMatch);
  if (str.startsWith('-----BEGIN')) {
    return '-----BEGIN ***REDACTED PRIVATE KEY***-----';
  }
  const underscoreIdx = str.indexOf('_');
  if (underscoreIdx > 0 && underscoreIdx <= 12) {
    return `${str.slice(0, underscoreIdx + 1)}***REDACTED***`;
  }
  return `${str.slice(0, 4)}***REDACTED***`;
}

export function scanTextForSecrets(content = '', filePath = '') {
  if (shouldSkipSecretScanPath(filePath)) return [];
  const findings = [];
  const lines = String(content).split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/secret-scan-ignore/i.test(line)) continue;
    for (const rule of SECRET_RULES) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        findings.push({
          filePath,
          line: idx + 1,
          ruleId: rule.id,
          label: rule.label,
          redactedMatch: redactSecretPreview(match[0]),
        });
      }
    }
  }
  return findings;
}

export function scanFilesForSecrets(filePaths = [], cwd = process.cwd()) {
  const findings = [];
  for (const relPath of filePaths) {
    if (shouldSkipSecretScanPath(relPath)) continue;
    const absPath = path.resolve(cwd, relPath);
    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    const text = fs.readFileSync(absPath, 'utf8');
    findings.push(...scanTextForSecrets(text, relPath));
  }
  return findings;
}

function getCandidateFiles(argv, cwd) {
  if (argv.includes('--all-tracked')) {
    const out = execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  }
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd, encoding: 'utf8' }
  );
  return out.split(/\r?\n/).filter(Boolean);
}

function main() {
  const cwd = process.cwd();
  const files = getCandidateFiles(process.argv.slice(2), cwd);
  const findings = scanFilesForSecrets(files, cwd);

  if (findings.length > 0) {
    console.error(
      'Secret scan blocked commit/check due to potential credentials:'
    );
    for (const f of findings) {
      console.error(
        `  - ${f.filePath}:${f.line} [${f.ruleId}] ${f.label} (${f.redactedMatch})`
      );
    }
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
