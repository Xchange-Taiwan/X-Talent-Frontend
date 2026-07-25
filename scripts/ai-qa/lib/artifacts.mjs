// Composes before/after comparison images and publishes them to a small,
// dedicated repo (`<owner>/X-Talent-Frontend-PR-Image-Public`) that exists for nothing
// else — never the product repo's git history, never even a branch of it.
// If that dedicated repo ever grows unwieldy, it can be wiped and
// `gh repo create`'d again from scratch with zero risk to the actual
// codebase; a branch-of-the-main-repo design can't offer that isolation.
//
// This repo must be PUBLIC, not private — confirmed empirically (see issue
// #318): an unauthenticated fetch of a private repo's raw.githubusercontent.com
// URL 404s. GitHub's web UI only serves private raw content via a
// short-lived signed token minted per page-load, not a stable URL — useless
// for an image meant to keep rendering in a PR comment for as long as the
// PR stays open. A public repo's raw URLs work with no auth at all, the
// same mechanism every public repo's README screenshots rely on. This does
// mean these QA screenshots are technically fetchable by anyone with the
// URL (not listed/discoverable, but not access-controlled either) — an
// accepted trade-off; see issue #318 for the discussion.
//
// Two other designs were tried and rejected before this one:
//  - `gh gist create` outright refuses binary files ("binary file not
//    supported"), and going around it via `gh api gists` with base64-encoded
//    content doesn't help either — GitHub's gist API stores whatever string
//    you send as literal text, it does not decode it server-side, so the
//    resulting raw_url just serves the base64 *text*, not a real image
//    (confirmed empirically: downloading it back gave an ASCII text file,
//    not a PNG).
//  - A free third-party image host would work technically, but adds a new
//    external account/dependency this tool doesn't otherwise need.
// Git blobs are byte-safe — `git add`/`push` handles arbitrary binary
// content natively — so a real commit to a real (if disposable) repo is the
// mechanism that actually works.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

export class ArtifactsError extends Error {}

const ARTIFACTS_REPO_NAME = 'X-Talent-Frontend-PR-Image-Public';
const LABEL_HEIGHT = 32;
const GAP = 16;

function git(args, opts = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', ...opts }).trim();
  } catch (err) {
    throw new ArtifactsError(
      `git ${args.join(' ')} failed: ${err.stderr || err.message}`
    );
  }
}

function gh(args, opts = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf-8', ...opts }).trim();
  } catch (err) {
    throw new ArtifactsError(
      `gh ${args.join(' ')} failed: ${err.stderr || err.message}`
    );
  }
}

function labelSvg(text, width) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_HEIGHT}">` +
      `<rect width="100%" height="100%" fill="#1f2937"/>` +
      `<text x="12" y="21" font-family="sans-serif" font-size="14" fill="#ffffff">${escaped}</text>` +
      `</svg>`
  );
}

async function panelInfo(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  return { buffer, width, height };
}

/**
 * Composes a labeled before/after comparison PNG at each screenshot's own
 * native resolution — no resizing, so nothing is lost off screenshots
 * already captured at 2x device scale (see mcp-client.mjs / screenshots.mjs)
 * for sharpness. Before and after are captured with the same viewport, so
 * they're normally already the same size; falling back to each panel's own
 * width/height (rather than assuming they match) keeps this correct even if
 * that ever isn't true. `beforeBuffer` is null when the route didn't exist
 * on the base ref (brand-new page this ticket introduces) — in that case
 * this returns a single labeled "after" panel instead of a side-by-side
 * layout with an empty half.
 */
export async function composeBeforeAfter(beforeBuffer, afterBuffer) {
  const after = await panelInfo(afterBuffer);

  if (!beforeBuffer) {
    return sharp({
      create: {
        width: after.width,
        height: LABEL_HEIGHT + after.height,
        channels: 4,
        background: { r: 243, g: 244, b: 246, alpha: 1 },
      },
    })
      .composite([
        {
          input: labelSvg(
            '改動後（本次新增頁面，無改動前畫面可比較）',
            after.width
          ),
          left: 0,
          top: 0,
        },
        { input: after.buffer, left: 0, top: LABEL_HEIGHT },
      ])
      .png()
      .toBuffer();
  }

  const before = await panelInfo(beforeBuffer);
  const bodyHeight = Math.max(before.height, after.height);
  const afterLeft = before.width + GAP;

  return sharp({
    create: {
      width: before.width + GAP + after.width,
      height: LABEL_HEIGHT + bodyHeight,
      channels: 4,
      background: { r: 243, g: 244, b: 246, alpha: 1 },
    },
  })
    .composite([
      { input: labelSvg('改動前 Before', before.width), left: 0, top: 0 },
      { input: before.buffer, left: 0, top: LABEL_HEIGHT },
      { input: labelSvg('改動後 After', after.width), left: afterLeft, top: 0 },
      { input: after.buffer, left: afterLeft, top: LABEL_HEIGHT },
    ])
    .png()
    .toBuffer();
}

function artifactsRepoExists(owner) {
  try {
    gh(['repo', 'view', `${owner}/${ARTIFACTS_REPO_NAME}`]);
    return true;
  } catch {
    return false;
  }
}

/** Auto-creates the dedicated artifacts repo (public — see module docstring
 * for why) the first time it's needed — same "create if missing" pattern
 * ai:dev already uses for the linked ticket branch, just at the repo level
 * instead of the branch level. */
function ensureArtifactsRepo(owner) {
  if (artifactsRepoExists(owner)) return;
  gh([
    'repo',
    'create',
    `${owner}/${ARTIFACTS_REPO_NAME}`,
    '--public',
    '--description',
    'QA screenshots for ai:dev (scripts/ai-qa) — public so raw.githubusercontent.com URLs render in PR comments. Auto-created, safe to wipe/recreate at any time.',
  ]);
}

/**
 * Pushes `files` (each `{ filename, buffer }`) under `<ticketNumber>/` to the
 * dedicated `<owner>/X-Talent-Frontend-PR-Image-Public` repo and returns their
 * raw.githubusercontent.com URLs. Best-effort by design — the caller
 * (qa-bridge.mjs) treats a thrown error here as "publish failed", degrades
 * the PR report to text-only, and does NOT let it affect the QA gate itself
 * (see issue #318: image upload failure must not block the pipeline).
 */
export async function publishArtifacts({ owner, ticketNumber, files }) {
  ensureArtifactsRepo(owner);

  const scratchDir = join(tmpdir(), `ai-qa-artifacts-${randomUUID()}`);
  git([
    'clone',
    `https://github.com/${owner}/${ARTIFACTS_REPO_NAME}.git`,
    scratchDir,
  ]);

  try {
    const destDir = join(scratchDir, String(ticketNumber));
    mkdirSync(destDir, { recursive: true });
    for (const file of files) {
      writeFileSync(join(destDir, file.filename), file.buffer);
    }

    git(['add', '.'], { cwd: scratchDir });
    // --allow-empty: a retry round whose screenshot is byte-identical to a
    // prior round's (same ticketNumber + filename, unchanged content) stages
    // nothing new — without this flag `git commit` exits 1 with "nothing to
    // commit", turning an unremarkable no-op into a publish failure.
    git(
      ['commit', '--allow-empty', '-m', `qa: screenshots for #${ticketNumber}`],
      { cwd: scratchDir }
    );
    git(['push', 'origin', 'HEAD'], { cwd: scratchDir });

    const branch = git(['branch', '--show-current'], { cwd: scratchDir });

    return files.map((file) => ({
      filename: file.filename,
      url: `https://raw.githubusercontent.com/${owner}/${ARTIFACTS_REPO_NAME}/${branch}/${ticketNumber}/${file.filename}`,
    }));
  } finally {
    try {
      rmSync(scratchDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        `[ai-qa] failed to remove artifacts scratch dir ${scratchDir}: ${err.message}`
      );
    }
  }
}
