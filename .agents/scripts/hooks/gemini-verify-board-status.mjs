#!/usr/bin/env node
/**
 * Cross-platform AfterAgent / Stop hook for Gemini CLI and Claude Code.
 * Uses Node.js instead of `bash` so it never hits Windows WSL `bash.exe`
 * (`execvpe(/bin/bash) failed`) errors on Windows machines.
 *
 * Verifies:
 *   1. If the current branch has an issue number (`feat/123-...` or `fix/123-...`),
 *      its GitHub issue in X-Talent-Tracker has a linked branch or PR in Development.
 *   2. The issue's Project V2 board status matches ground truth:
 *      - Open PR exists -> "PR Review"
 *      - No open PR yet -> "In progress"
 *      (Leaves post-PR columns like "QA Review", "Done", "Blocked", "Cancel" untouched.)
 *
 * Automatically self-heals both on GitHub before returning `{}` so the agent
 * doesn't even have to spend an extra turn unless self-healing fails.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { linkTicketBranch } from '../link-ticket-branch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const isClaudeHook = process.argv.includes('--claude');

function finishOk() {
  if (!isClaudeHook) {
    process.stdout.write('{}\n');
  }
  process.exit(0);
}

function runCmd(bin, args) {
  return execFileSync(bin, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

try {
  process.chdir(repoRoot);
  const branch = runCmd('git', ['branch', '--show-current']);

  if (!branch || branch === 'develop' || branch === 'main') {
    finishOk();
  }

  const m = branch.match(/(\d+)/);
  if (!m) finishOk();
  const issueNumber = Number(m[1]);

  const configPath = path.join(repoRoot, 'docs/agents/project-config.md');
  if (!fs.existsSync(configPath)) finishOk();
  const configMd = fs.readFileSync(configPath, 'utf8');
  const jsonMatch = configMd.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) finishOk();

  const cfg = JSON.parse(jsonMatch[1]);
  const org = cfg.org;
  const trackerRepo = cfg.repos.tracker;
  const frontendRepo = cfg.repos.frontend;
  const projectNumber = Number(cfg.project.number);
  const projectId = cfg.project.id;
  const fieldId = cfg.fields.status.id;
  const inProgressOpt = cfg.fields.status.options.in_progress;
  const prReviewOpt = cfg.fields.status.options.pr_review;

  const openPrOut = runCmd('gh', [
    'pr',
    'list',
    '--repo',
    `${org}/${frontendRepo}`,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    'length',
  ]);
  const openPrCount = Number(openPrOut) || 0;

  const expectedOpt = openPrCount > 0 ? prReviewOpt : inProgressOpt;

  const issueQuery =
    'query($login:String!,$repo:String!,$num:Int!){repository(owner:$login,name:$repo){issue(number:$num){id linkedBranches(first:5){nodes{ref{name}}} closedByPullRequestsReferences(first:5){nodes{number}} projectItems(first:10){nodes{id project{number} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name optionId}}}}}}}';

  const queryRepo = (repoName) => {
    try {
      const rawIssue = runCmd('gh', [
        'api',
        'graphql',
        '-f',
        `login=${org}`,
        '-f',
        `repo=${repoName}`,
        '-F',
        `num=${issueNumber}`,
        '-f',
        `query=${issueQuery}`,
      ]);
      return JSON.parse(rawIssue)?.data?.repository?.issue ?? null;
    } catch {
      return null;
    }
  };

  let issue = queryRepo(trackerRepo);
  if (!issue?.id && trackerRepo !== frontendRepo) {
    issue = queryRepo(frontendRepo);
  }
  if (!issue?.id) finishOk();

  // 1. Self-heal missing branch link via shared linkTicketBranch
  const lbCount = (issue.linkedBranches?.nodes || []).length;
  const prCount = (issue.closedByPullRequestsReferences?.nodes || []).length;
  if (lbCount === 0 && prCount === 0) {
    try {
      linkTicketBranch([
        String(issueNumber),
        branch,
        '--no-checkout',
        '--no-board-update',
      ]);
    } catch {}
  }

  // 2. Self-heal Project V2 board status
  const pItem = (issue.projectItems?.nodes || []).find(
    (n) => n?.project?.number === projectNumber
  );
  let itemId = pItem?.id;
  const curLabel = pItem?.fieldValueByName?.name || '';
  const curOpt = pItem?.fieldValueByName?.optionId || '';

  if (['QA Review', 'Done', 'Blocked', 'Cancel'].includes(curLabel)) {
    finishOk();
  }
  if (openPrCount === 0 && curLabel === 'PR Review') {
    finishOk();
  }
  if (curOpt === expectedOpt) {
    finishOk();
  }

  if (!itemId && projectId) {
    const addMut =
      'mutation($proj:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$proj,contentId:$content}){item{id}}}';
    itemId = runCmd('gh', [
      'api',
      'graphql',
      '-f',
      `proj=${projectId}`,
      '-f',
      `content=${issue.id}`,
      '-f',
      `query=${addMut}`,
      '--jq',
      '.data.addProjectV2ItemById.item.id',
    ]);
  }

  if (itemId) {
    const upMut =
      'mutation($proj:ID!,$item:ID!,$field:ID!,$opt:String!){updateProjectV2ItemFieldValue(input:{projectId:$proj,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$opt}}){projectV2Item{id}}}';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        runCmd('gh', [
          'api',
          'graphql',
          '-f',
          `proj=${projectId}`,
          '-f',
          `item=${itemId}`,
          '-f',
          `field=${fieldId}`,
          '-f',
          `opt=${expectedOpt}`,
          '-f',
          `query=${upMut}`,
        ]);
        finishOk();
      } catch {}
    }
  }
} catch {
  // Always fail-open so unrelated work is never blocked
}

finishOk();
