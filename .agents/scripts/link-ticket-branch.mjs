#!/usr/bin/env node
/**
 * Core cross-platform Node.js implementation for linking a Git branch in
 * $FRONTEND_REPO to an issue in $TRACKER_REPO (or $FRONTEND_REPO) via
 * GitHub's GraphQL `createLinkedBranch` mutation, verifying `linkedBranches` /
 * `closedByPullRequestsReferences`, and moving the Project V2 board item to
 * "In progress".
 *
 * Uses `execFileSync` with argument arrays exclusively (zero shell string
 * interpolation) and always uses a remote-known commit OID (`REMOTE_OID` or
 * `origin/develop`) for `createLinkedBranch` so unpushed local commits never
 * cause `createLinkedBranch` to fail after deleting an unlinked remote ref.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function runGit(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw err;
  }
}

function runGh(args, { allowFail = false } = {}) {
  try {
    return execFileSync('gh', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw err;
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function loadConfig() {
  let configMd = runGh(
    [
      'api',
      '/repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main',
      '-H',
      'Accept: application/vnd.github.raw',
    ],
    { allowFail: true }
  );

  let match = configMd ? configMd.match(/```json\s*([\s\S]*?)\s*```/) : null;
  if (!match) {
    const localPath = path.join(repoRoot, 'docs/agents/project-config.md');
    if (fs.existsSync(localPath)) {
      configMd = fs.readFileSync(localPath, 'utf8');
      match = configMd.match(/```json\s*([\s\S]*?)\s*```/);
    }
  }
  if (!match) {
    throw new Error(
      'ERROR: project-config.md is malformed or missing JSON block'
    );
  }
  return JSON.parse(match[1]);
}

function queryIssueState(org, repoName, issueNumber) {
  const query = `
    query($login: String!, $repo: String!, $issue_number: Int!) {
      repository(owner: $login, name: $repo) {
        issue(number: $issue_number) {
          id
          number
          title
          linkedBranches(first: 10) {
            nodes {
              id
              ref { name }
            }
          }
          closedByPullRequestsReferences(first: 10) {
            nodes {
              number
              state
              headRefName
              url
            }
          }
          projectItems(first: 10) {
            nodes {
              id
              project { number }
            }
          }
        }
      }
    }
  `;
  const out = runGh(
    [
      'api',
      'graphql',
      '-f',
      `login=${org}`,
      '-f',
      `repo=${repoName}`,
      '-F',
      `issue_number=${issueNumber}`,
      '-f',
      `query=${query}`,
    ],
    { allowFail: true }
  );
  if (!out) return null;
  try {
    return JSON.parse(out)?.data?.repository?.issue ?? null;
  } catch {
    return null;
  }
}

export function deriveBranchNameFromIssue(issueNumber, rawTitle = '') {
  const title = String(rawTitle ?? '');
  const prefix = /\[bug\]|修復|異常|破版/i.test(title) ? 'fix' : 'feat';
  const withoutTags = title.replace(/^(\[[^\]]+\]\s*)+/, '');
  const asciiWords = withoutTags
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.slice(0, 5)
    ?.join('-');
  const slug = asciiWords || 'impl';
  return `${prefix}/${issueNumber}-${slug}`;
}

export function linkTicketBranch(argv = process.argv.slice(2)) {
  const cfg = loadConfig();
  const org = cfg.org;
  const trackerRepo = cfg.repos.tracker;
  const frontendRepo = cfg.repos.frontend;
  const projectNumber = Number(cfg.project.number);
  const projectId = cfg.project.id;
  const fieldId = cfg.fields.status.id;
  const inProgressOptionId = cfg.fields.status.options.in_progress;

  let noCheckout = false;
  let noBoardUpdate = false;
  const positional = [];

  for (const arg of argv) {
    if (arg === '--no-checkout' || arg === '-NoCheckout') {
      noCheckout = true;
    } else if (arg === '--no-board-update' || arg === '-NoBoardUpdate') {
      noBoardUpdate = true;
    } else {
      positional.push(arg);
    }
  }

  const rawIssue = positional[0] || '';
  const currentBranch = runGit(['branch', '--show-current'], {
    allowFail: true,
  });
  let targetBranch = positional[1] || currentBranch;

  let issueRepo = trackerRepo;
  let issueNumber = 0;

  if (rawIssue) {
    const urlMatch = rawIssue.match(
      /github\.com\/[^/]+\/([^/]+)\/issues\/(\d+)/
    );
    if (urlMatch) {
      issueRepo = urlMatch[1];
      issueNumber = Number(urlMatch[2]);
    } else {
      const numMatch = rawIssue.match(/(\d+)/);
      if (numMatch) issueNumber = Number(numMatch[1]);
    }
  }

  if (!issueNumber && targetBranch) {
    const numMatch = targetBranch.match(/(\d+)/);
    if (numMatch) issueNumber = Number(numMatch[1]);
  }

  if (!issueNumber) {
    console.log(
      `⚠️ Could not determine issue number from arguments or branch '${targetBranch}'. Skipping branch link.`
    );
    return;
  }

  let issueObj = queryIssueState(org, issueRepo, issueNumber);
  if (!issueObj?.id && issueRepo !== frontendRepo) {
    issueRepo = frontendRepo;
    issueObj = queryIssueState(org, issueRepo, issueNumber);
  }
  if (!issueObj?.id) {
    throw new Error(
      `ERROR: Could not find issue #${issueNumber} in ${org}/${trackerRepo} or ${org}/${frontendRepo}.`
    );
  }

  if (!targetBranch || targetBranch === 'develop' || targetBranch === 'main') {
    const preLinked = (issueObj.linkedBranches?.nodes || [])
      .map((n) => n?.ref?.name)
      .find((b) => b && b !== 'develop' && b !== 'main');
    targetBranch =
      preLinked || deriveBranchNameFromIssue(issueNumber, issueObj.title);
    console.log(
      `ℹ️ Auto-selected target branch '${targetBranch}' for #${issueNumber}.`
    );
  }

  const repoIdQuery = `
    query($login: String!, $repo: String!) {
      repository(owner: $login, name: $repo) { id }
    }
  `;
  const repoNodeId = runGh([
    'api',
    'graphql',
    '-f',
    `login=${org}`,
    '-f',
    `repo=${frontendRepo}`,
    '-f',
    `query=${repoIdQuery}`,
    '--jq',
    '.data.repository.id',
  ]);

  const existingBranches = (issueObj.linkedBranches?.nodes || [])
    .map((n) => n?.ref?.name)
    .filter(Boolean);
  const existingPrs = (issueObj.closedByPullRequestsReferences?.nodes || [])
    .map((n) => n?.headRefName)
    .filter(Boolean);

  if (existingBranches.length > 0 || existingPrs.length > 0) {
    console.log(
      `✅ Issue #${issueNumber} (${issueRepo}) is already linked to branch/PR on GitHub.`
    );
  } else {
    // Always resolve a commit OID that is GUARANTEED to exist on GitHub (origin)
    // so createLinkedBranch never fails due to unpushed local commits.
    runGit(['fetch', 'origin', 'develop', '--quiet'], { allowFail: true });
    let remoteBaseOid = runGit(['rev-parse', 'refs/remotes/origin/develop'], {
      allowFail: true,
    });
    if (!remoteBaseOid) {
      remoteBaseOid = runGit(['rev-parse', 'HEAD']);
    }

    const lsRemote = runGit(['ls-remote', '--heads', 'origin', targetBranch], {
      allowFail: true,
    });
    let branchOidForMutation = remoteBaseOid;

    if (lsRemote) {
      const remoteOid = lsRemote.split(/\s+/)[0];
      if (remoteOid) {
        branchOidForMutation = remoteOid;
      }
      const allPrCountStr = runGh(
        [
          'pr',
          'list',
          '--repo',
          `${org}/${frontendRepo}`,
          '--head',
          targetBranch,
          '--state',
          'all',
          '--json',
          'number',
          '--jq',
          'length',
        ],
        { allowFail: true }
      );
      const allPrCount = Number(allPrCountStr) || 0;
      if (allPrCount === 0) {
        console.log(
          `ℹ️ Remote branch origin/${targetBranch} already exists without a link; recreating via createLinkedBranch at ${branchOidForMutation}...`
        );
        runGit(['push', 'origin', '--delete', targetBranch], {
          allowFail: true,
        });
      }
    }

    const createMut = `
      mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
        createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
          linkedBranch { id ref { name } }
        }
      }
    `;
    const mutOut = runGh(
      [
        'api',
        'graphql',
        '-f',
        `query=${createMut}`,
        '-f',
        `issueId=${issueObj.id}`,
        '-f',
        `repositoryId=${repoNodeId}`,
        '-f',
        `oid=${branchOidForMutation}`,
        '-f',
        `name=${targetBranch}`,
      ],
      { allowFail: true }
    );

    let linkedId = '';
    try {
      linkedId =
        JSON.parse(mutOut)?.data?.createLinkedBranch?.linkedBranch?.id || '';
    } catch {}

    if (linkedId) {
      console.log(
        `✅ Linked branch '${targetBranch}' to ${org}/${issueRepo}#${issueNumber} (id: ${linkedId})`
      );
    }
  }

  runGit(['fetch', 'origin', targetBranch], { allowFail: true });
  const hasLocalBranch = Boolean(
    runGit(['show-ref', '--verify', `refs/heads/${targetBranch}`], {
      allowFail: true,
    })
  );
  const hasRemoteBranch = Boolean(
    runGit(['show-ref', '--verify', `refs/remotes/origin/${targetBranch}`], {
      allowFail: true,
    })
  );

  if (!noCheckout) {
    const nowBranch = runGit(['branch', '--show-current'], { allowFail: true });
    if (nowBranch !== targetBranch) {
      if (hasLocalBranch) {
        runGit(['checkout', targetBranch]);
      } else if (hasRemoteBranch) {
        runGit([
          'checkout',
          '-b',
          targetBranch,
          '--track',
          `origin/${targetBranch}`,
        ]);
      } else {
        runGit(['checkout', '-b', targetBranch]);
      }
    }
  }

  if (
    runGit(['show-ref', '--verify', `refs/heads/${targetBranch}`], {
      allowFail: true,
    }) &&
    hasRemoteBranch
  ) {
    runGit(
      ['branch', `--set-upstream-to=origin/${targetBranch}`, targetBranch],
      {
        allowFail: true,
      }
    );
  }

  // Verify Development link on GitHub
  const verifyObj = queryIssueState(org, issueRepo, issueNumber);
  const vBranches = (verifyObj?.linkedBranches?.nodes || [])
    .map((n) => n?.ref?.name)
    .filter(Boolean);
  const vPrs = (verifyObj?.closedByPullRequestsReferences?.nodes || [])
    .map((n) => `#${n?.number}`)
    .filter(Boolean);

  if (vBranches.length > 0 || vPrs.length > 0) {
    console.log(
      `✅ Verified Development link on #${issueNumber}: linkedBranches=[${vBranches.join(',')}] linkedPRs=[${vPrs.join(',')}]`
    );
  } else {
    const existingPrNum = runGh(
      [
        'pr',
        'list',
        '--repo',
        `${org}/${frontendRepo}`,
        '--head',
        targetBranch,
        '--state',
        'all',
        '--limit',
        '1',
        '--json',
        'number',
        '--jq',
        '.[0].number // empty',
      ],
      { allowFail: true }
    );
    if (existingPrNum) {
      const issueUrl = `https://github.com/${org}/${issueRepo}/issues/${issueNumber}`;
      const curBody = runGh(
        [
          'pr',
          'view',
          existingPrNum,
          '--repo',
          `${org}/${frontendRepo}`,
          '--json',
          'body',
          '--jq',
          '.body // ""',
        ],
        { allowFail: true }
      );
      if (
        !curBody.includes(`Closes ${issueUrl}`) &&
        !curBody.includes(`Closes ${org}/${issueRepo}#${issueNumber}`)
      ) {
        runGh(
          [
            'pr',
            'edit',
            existingPrNum,
            '--repo',
            `${org}/${frontendRepo}`,
            '--body',
            `${curBody}\n\nCloses ${issueUrl}`,
          ],
          { allowFail: true }
        );
        console.log(`✅ Linked existing PR #${existingPrNum} to ${issueUrl}`);
      }
    } else {
      console.warn(
        `⚠️ Warning: #${issueNumber} still has no linkedBranches or linkedPRs in Development.`
      );
    }
  }

  // Move Ticket on Project V2 Board to "In progress"
  if (!noBoardUpdate) {
    let itemId =
      (verifyObj?.projectItems?.nodes || []).find(
        (n) => n?.project?.number === projectNumber
      )?.id || '';

    if (!itemId && projectId && issueObj.id) {
      const addMut = `
        mutation($project_id: ID!, $content_id: ID!) {
          addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
            item { id }
          }
        }
      `;
      itemId = runGh(
        [
          'api',
          'graphql',
          '-f',
          `project_id=${projectId}`,
          '-f',
          `content_id=${issueObj.id}`,
          '-f',
          `query=${addMut}`,
          '--jq',
          '.data.addProjectV2ItemById.item.id',
        ],
        { allowFail: true }
      );
      sleepSync(3000);
    }

    if (itemId && inProgressOptionId && inProgressOptionId !== 'null') {
      const upMut = `
        mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
          updateProjectV2ItemFieldValue(
            input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
          ) { projectV2Item { id } }
        }
      `;
      for (let attempt = 1; attempt <= 4; attempt++) {
        runGh(
          [
            'api',
            'graphql',
            '-f',
            `project_id=${projectId}`,
            '-f',
            `item_id=${itemId}`,
            '-f',
            `field_id=${fieldId}`,
            '-f',
            `option_id=${inProgressOptionId}`,
            '-f',
            `query=${upMut}`,
          ],
          { allowFail: true }
        );
        sleepSync(2000);
        const actualOpt = runGh(
          [
            'api',
            'graphql',
            '-f',
            `item_id=${itemId}`,
            '-f',
            'query=query($item_id: ID!) { node(id: $item_id) { ... on ProjectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } } } } }',
            '--jq',
            '.data.node.fieldValueByName.optionId // empty',
          ],
          { allowFail: true }
        );
        if (actualOpt === inProgressOptionId) break;
      }
      console.log(
        `✅ Ticket #${issueNumber} moved to In progress on Project Board`
      );
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  linkTicketBranch();
}
