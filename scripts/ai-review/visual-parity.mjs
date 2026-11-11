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

import { extractExistingEvidenceUrls } from '../generate-pr-description.mjs';
import {
  downloadVerifiedImage,
  extractTicketImageCandidates,
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
import { extractTicketNumber, fetchRawArchitectureKb } from './lib/ticket.mjs';

const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';
const FRONTEND_OWNER = 'Xchange-Taiwan';
const FRONTEND_REPO = 'X-Talent-Frontend';
const MAX_REF_IMAGES = 4;
const MAX_EVIDENCE_IMAGES = 4;
const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024;

function isUiFile(filePath = '') {
  const f = String(filePath).replace(/\\/g, '/').trim();
  if (!f) return false;
  if (/\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(f)) return false;
  if (f.startsWith('src/app/api/')) return false;
  return (
    (f.startsWith('src/app/') ||
      f.startsWith('src/components/') ||
      f.startsWith('src/styles/')) &&
    /\.(tsx|jsx|css)$/.test(f)
  );
}

async function fetchIssueHtmlBlocks(ticketNumber, token) {
  if (!ticketNumber || !token) return [];
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.full+json',
  };
  const baseUrl = `https://api.github.com/repos/${TRACKER_OWNER}/${TRACKER_REPO}/issues/${ticketNumber}`;
  try {
    const issueRes = await fetch(baseUrl, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (!issueRes.ok) return [];
    const issue = await issueRes.json();

    const commentsRes = await fetch(`${baseUrl}/comments?per_page=50`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    const comments = commentsRes.ok ? await commentsRes.json() : [];
    return [issue, ...(Array.isArray(comments) ? comments : [])];
  } catch {
    return [];
  }
}

async function fetchPrScreenshots(prNumber, githubToken) {
  if (!prNumber) return [];
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };
  try {
    const prRes = await fetch(
      `https://api.github.com/repos/${FRONTEND_OWNER}/${FRONTEND_REPO}/pulls/${prNumber}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!prRes.ok) return [];
    const pr = await prRes.json();
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
  const hasUiChanges = touchedFiles.some(isUiFile);

  if (!hasUiChanges) {
    const skipped = {
      hasFindings: false,
      summary: '本次 PR 未修改前端 UI 畫面元件，略過視覺設計對齊審查',
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

  const designSpecsObj =
    kb?.matchedDesignSpecs || kb?.matchedDomains?.design_hub || null;
  const designSpecsMarkdown = designSpecsObj
    ? '```json\n' +
      JSON.stringify(designSpecsObj, null, 2).slice(0, 10000) +
      '\n```'
    : '（Cloudflare KV 無對應此票號之 Design Hub 記錄，請依據 Ticket 設計參考圖與規格審查）';

  if (
    refImages.length === 0 &&
    prImages.length === 0 &&
    !kb?.matchedDesignSpecs
  ) {
    const noRef = {
      hasFindings: false,
      summary: '此 Ticket 無附設計圖與 Design Hub 對照規格，略過視覺比對',
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

main().catch((err) => {
  console.warn(`[visual-parity] Non-fatal error: ${err.message}`);
  const fallback = {
    hasFindings: false,
    summary: `視覺審查略過（${err.message}）`,
    findings: [],
  };
  writeGithubOutput('findings', encodeContext(fallback));
});
