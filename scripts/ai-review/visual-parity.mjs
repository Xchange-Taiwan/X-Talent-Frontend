/**
 * GitHub Actions CI/CD stage: `AI Review: Visual / Design Parity`.
 *
 * Fetches:
 *   1. Cloudflare KV `matchedDesignSpecs` / `design_hub` rules via `/__arch-kb`
 *   2. Private `X-Talent-Tracker` Ticket & Comment reference images (`body_html` signed JWT URLs)
 *   3. Standalone Design Hub HTML prototype screenshots (if applicable)
 *   4. Implemented `pr-evidence` screenshots embedded in the Pull Request body
 * and invokes multimodal `gemini-4-carbon` to detect layout/alignment/styling drift.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { extractExistingEvidenceUrls } from '../generate-pr-description.mjs';
import {
  downloadVerifiedImage,
  extractTicketImageCandidates,
  prioritizeIssueAndCommentBlocks,
  sniffImageMimeType,
} from '../prefetch-ticket-visuals.mjs';
import {
  decodeContext,
  encodeContext,
  writeGithubOutput,
} from './lib/context-io.mjs';
import { getDiff } from './lib/diff.mjs';
import { callGemini } from './lib/gemini.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import {
  extractTicketNumber,
  fetchRawArchitectureKb,
  isUiReviewFile,
  resolveDesignSpecsFromKb,
} from './lib/ticket.mjs';
import { MAX_EVIDENCE_IMAGES, MAX_REF_IMAGES } from './lib/visuals.mjs';

const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';
const FRONTEND_OWNER = 'Xchange-Taiwan';
const FRONTEND_REPO = 'X-Talent-Frontend';
const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024;

export { isUiReviewFile, MAX_EVIDENCE_IMAGES, MAX_REF_IMAGES };

export function shouldSkipVisualParity({
  hasUiChanges,
  refImagesCount = 0,
  prImagesCount = 0,
  designSpecsObj = null,
}) {
  if (!hasUiChanges) {
    return {
      skip: true,
      summary: '本次 PR 未修改前端 UI 畫面元件，略過視覺設計對齊審查',
    };
  }
  if (refImagesCount === 0 && prImagesCount === 0 && !designSpecsObj) {
    return {
      skip: true,
      summary: '此 Ticket 無附設計圖與 Design Hub 對照規格，略過視覺比對',
    };
  }
  return { skip: false, summary: '' };
}

function ghApiJson(
  apiPath,
  token,
  acceptHeader = 'application/vnd.github+json'
) {
  const out = execFileSync(
    'gh',
    ['api', apiPath, '-H', `Accept: ${acceptHeader}`],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
      env: { ...process.env, ...(token ? { GH_TOKEN: token } : {}) },
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  );
  return JSON.parse(out);
}

async function fetchIssueHtmlBlocks(ticketNumber, token) {
  if (!ticketNumber || !token) return [];
  const basePath = `repos/${TRACKER_OWNER}/${TRACKER_REPO}/issues/${ticketNumber}`;
  try {
    const issue = ghApiJson(
      basePath,
      token,
      'application/vnd.github.full+json'
    );
    let comments = [];
    try {
      const c = ghApiJson(
        `${basePath}/comments?per_page=100`,
        token,
        'application/vnd.github.full+json'
      );
      if (Array.isArray(c)) comments = c;
    } catch {}
    return prioritizeIssueAndCommentBlocks(issue, comments);
  } catch {
    return [];
  }
}

async function fetchPrScreenshots(prNumber, githubToken) {
  if (!prNumber) return [];
  try {
    const pr = ghApiJson(
      `repos/${FRONTEND_OWNER}/${FRONTEND_REPO}/pulls/${prNumber}`,
      githubToken
    );
    const urls = extractExistingEvidenceUrls(pr?.body || '').slice(
      0,
      MAX_EVIDENCE_IMAGES
    );

    const images = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const dl = await downloadVerifiedImage(url, githubToken);
        if (!dl || dl.buffer.length > MAX_SINGLE_IMAGE_BYTES) continue;
        const sniffed = sniffImageMimeType(dl.buffer);
        if (!sniffed) continue;
        const fileName = decodeURIComponent(
          new URL(url).pathname.split('/').pop() || `pr-shot-${i + 1}.png`
        );
        images.push({
          mimeType: sniffed.mimeType,
          base64Data: dl.buffer.toString('base64'),
          label: `實作後 Playwright 實際截圖證據: ${fileName}`,
        });
      } catch {
        // Skip failed image download
      }
    }
    return images;
  } catch {
    return [];
  }
}

async function main() {
  const baseRef = process.env.BASE_REF;
  const headSha = process.env.HEAD_SHA;
  const headBranch = process.env.HEAD_REF || '';
  const prNumber = process.env.PR_NUMBER || '';
  const trackerToken = process.env.TRACKER_READ_TOKEN || '';
  const githubToken = process.env.GITHUB_TOKEN || trackerToken;

  if (!baseRef || !headSha) {
    throw new Error('BASE_REF and HEAD_SHA env vars are required');
  }

  const plan = decodeContext(process.env.PLAN_B64);
  if (!plan) {
    throw new Error('PLAN_B64 env var is required');
  }

  const touchedFiles = Array.isArray(plan.filesTouched)
    ? plan.filesTouched
    : [];
  const hasUiChanges = touchedFiles.some(isUiReviewFile);

  const preCheck = shouldSkipVisualParity({
    hasUiChanges,
    refImagesCount: 1,
  });
  if (preCheck.skip) {
    const skipped = {
      hasFindings: false,
      summary: preCheck.summary,
      findings: [],
    };
    writeGithubOutput('findings', encodeContext(skipped));
    return;
  }

  const ticketNumber = plan.ticketNumber || extractTicketNumber(headBranch, '');

  const [kb, htmlBlocks, prImages] = await Promise.all([
    fetchRawArchitectureKb(
      ticketNumber
        ? `#${ticketNumber} ${plan.requirementSummary || ''} ${headBranch}`
        : headBranch
    ),
    fetchIssueHtmlBlocks(ticketNumber, trackerToken),
    fetchPrScreenshots(prNumber, githubToken),
  ]);

  const refCandidates = extractTicketImageCandidates(htmlBlocks).slice(
    0,
    MAX_REF_IMAGES
  );
  const refImages = [];
  for (let i = 0; i < refCandidates.length; i++) {
    const c = refCandidates[i];
    try {
      const dl = await downloadVerifiedImage(c.url, trackerToken);
      if (!dl || dl.buffer.length > MAX_SINGLE_IMAGE_BYTES) continue;
      refImages.push({
        mimeType: dl.mimeType,
        base64Data: dl.buffer.toString('base64'),
        label: `Ticket/DesignHub 設計參考圖 #${i + 1}${c.alt ? ` (${c.alt})` : ''}`,
      });
    } catch {
      // Ignore unreachable attachment
    }
  }

  const designSpecsObj = resolveDesignSpecsFromKb(kb);
  const designSpecsMarkdown = designSpecsObj
    ? '```json\n' +
      JSON.stringify(designSpecsObj, null, 2).slice(0, 10000) +
      '\n```'
    : '（Cloudflare KV 無對應此票號之 Design Hub 記錄，請依據 Ticket 設計參考圖與規格審查）';

  const postCheck = shouldSkipVisualParity({
    hasUiChanges,
    refImagesCount: refImages.length,
    prImagesCount: prImages.length,
    designSpecsObj,
  });
  if (postCheck.skip) {
    const noRef = {
      hasFindings: false,
      summary: postCheck.summary,
      findings: [],
    };
    writeGithubOutput('findings', encodeContext(noRef));
    return;
  }

  const allImages = [...refImages, ...prImages];
  const visualNote = [
    '## 多模態視覺審查附件清單',
    `- 已附上 ${refImages.length} 張 Ticket／Design Hub 設計參考圖`,
    `- 已附上 ${prImages.length} 張本 PR 實測截圖（pr-evidence）`,
  ].join('\n');

  const { diff, truncated } = getDiff(baseRef, headSha);
  const prompt = buildPrompt(
    new URL('./prompts/visual-parity.md', import.meta.url),
    {
      PLAN_JSON: JSON.stringify(plan, null, 2),
      DESIGN_HUB_SPECS: designSpecsMarkdown,
      VISUAL_CONTEXT: visualNote,
      DIFF: diff,
      TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
    }
  );

  const result = await callGemini(prompt, { images: allImages });
  console.log('[visual-parity] result:', JSON.stringify(result, null, 2));
  writeGithubOutput('findings', encodeContext(result));
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch((err) => {
    console.warn(`[visual-parity] Non-fatal error: ${err.message}`);
    const fallback = {
      hasFindings: false,
      skippedDueToError: true,
      summary: `視覺審查因暫時性錯誤略過（${err.message}）`,
      findings: [],
    };
    writeGithubOutput('findings', encodeContext(fallback));
  });
}
