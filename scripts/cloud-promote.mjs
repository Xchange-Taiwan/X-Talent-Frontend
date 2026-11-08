#!/usr/bin/env node
/**
 * Local-to-Cloud Promote CLI (`pnpm cloud:promote`)
 *
 * Allows an engineer who finished coding or prompting locally to push their
 * current feature branch and immediately trigger `cloud-implement.yml` on
 * GitHub Actions to run:
 *   - Up to 20 rounds of free Gemini (`gemini-4-argon`) 7-Agent AI Review
 *   - Playwright E2E (`pnpm test:e2e:mock` + changed specs) self-healing
 *   - UI evidence capture & Pull Request creation / board status sync
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractTicketNumber } from './ai-review/lib/ticket.mjs';
import { clampMaxRounds } from './cloud-converge-loop.mjs';

const SAFE_BRANCH_REGEX = /^[A-Za-z0-9._/-]+$/;
const PROTECTED_BRANCHES = new Set(['develop', 'main', 'master', 'HEAD']);

export function validateBranchForPromote(branchName) {
  const clean = String(branchName ?? '').trim();
  if (!clean) {
    return {
      valid: false,
      reason: 'Branch name is empty (detached HEAD is not supported).',
    };
  }
  if (PROTECTED_BRANCHES.has(clean)) {
    return {
      valid: false,
      reason: `Cannot promote protected branch '${clean}'. Please create a feature/fix branch first.`,
    };
  }
  if (
    !SAFE_BRANCH_REGEX.test(clean) ||
    clean.includes('..') ||
    clean.startsWith('-') ||
    clean.startsWith('/')
  ) {
    return {
      valid: false,
      reason: `Invalid branch name '${clean}'.`,
    };
  }
  return { valid: true, branchName: clean };
}

export function parsePromoteArgs(argv = [], currentBranch = '') {
  let explicitTicket = '';
  let maxRounds = 20;
  let runE2e = true;
  let extraPrompt = '';
  let noCommit = false;

  for (const arg of argv) {
    if (arg.startsWith('--ticket=')) {
      explicitTicket = arg.slice('--ticket='.length).trim();
    } else if (arg.startsWith('--max-rounds=')) {
      maxRounds = clampMaxRounds(arg.slice('--max-rounds='.length), 20);
    } else if (arg.startsWith('--run-e2e=')) {
      const val = arg.slice('--run-e2e='.length).toLowerCase().trim();
      runE2e = val !== 'false' && val !== '0';
    } else if (arg.startsWith('--prompt=')) {
      extraPrompt = arg.slice('--prompt='.length).trim();
    } else if (arg === '--no-commit') {
      noCommit = true;
    } else if (/^#?\d+$/.test(arg.trim()) && !explicitTicket) {
      explicitTicket = arg.trim();
    }
  }

  const ticketNumber = extractTicketNumber(currentBranch, explicitTicket);

  return {
    ticketNumber: ticketNumber ? String(ticketNumber) : '',
    branchName: String(currentBranch ?? '').trim(),
    maxRounds,
    runE2e,
    extraPrompt,
    noCommit,
  };
}

export function buildWorkflowDispatchArgs({
  ticketNumber,
  branchName,
  maxRounds = 20,
  runE2e = true,
  extraPrompt = '',
  repo = 'Xchange-Taiwan/X-Talent-Frontend',
}) {
  const args = [
    'workflow',
    'run',
    'cloud-implement.yml',
    '--repo',
    repo,
    '-f',
    `ticket_number=${ticketNumber}`,
    '-f',
    `branch_name=${branchName}`,
    '-f',
    `max_review_rounds=${clampMaxRounds(maxRounds, 20)}`,
    '-f',
    `run_e2e=${runE2e ? 'true' : 'false'}`,
  ];

  if (extraPrompt && extraPrompt.trim()) {
    args.push('-f', `extra_prompt=${extraPrompt.trim()}`);
  }

  return args;
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function promoteLocalBranchToCloud(argv = process.argv.slice(2)) {
  const currentBranch = runGit(['branch', '--show-current']);
  const branchCheck = validateBranchForPromote(currentBranch);
  if (!branchCheck.valid) {
    throw new Error(branchCheck.reason);
  }

  const parsed = parsePromoteArgs(argv, currentBranch);
  if (!parsed.ticketNumber) {
    throw new Error(
      `Could not infer ticket number from branch '${currentBranch}'. Please pass --ticket=<number> (e.g. pnpm cloud:promote --ticket=822).`
    );
  }

  const statusOutput = runGit(['status', '--porcelain']);
  if (statusOutput && !parsed.noCommit) {
    console.log(
      '[cloud-promote] Uncommitted local changes detected; staging source changes (excluding .env*)...'
    );
    runGit(['add', '-A']);
    try {
      runGit(['reset', 'HEAD', '--', '.env*', '*/.env*']);
    } catch {}
    const stagedDiff = runGit(['diff', '--cached', '--name-only']);
    if (stagedDiff) {
      runGit([
        'commit',
        '-m',
        `chore(wip): checkpoint local work for cloud 20-round AI review & E2E (#${parsed.ticketNumber})`,
      ]);
    }
  }

  console.log(
    `[cloud-promote] Pushing branch '${parsed.branchName}' to origin...`
  );
  runGit(['push', '-u', 'origin', parsed.branchName]);

  const ghArgs = buildWorkflowDispatchArgs(parsed);
  console.log(
    `[cloud-promote] Triggering Cloud AI Implement + ${parsed.maxRounds}-Round AI Review + E2E workflow for Ticket #${parsed.ticketNumber}...`
  );
  execFileSync('gh', ghArgs, { stdio: 'inherit' });

  console.log(
    `\n[cloud-promote] Triggered successfully! View runs at:\nhttps://github.com/Xchange-Taiwan/X-Talent-Frontend/actions/workflows/cloud-implement.yml`
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    promoteLocalBranchToCloud(process.argv.slice(2));
  } catch (err) {
    console.error(`[cloud-promote] Error: ${err.message}`);
    process.exit(1);
  }
}
