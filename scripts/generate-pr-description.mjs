#!/usr/bin/env node
/**
 * Generates high-signal Traditional Chinese Pull Request descriptions
 * (`## What Does This PR Do?`, `## Demo`, labeled `## Screenshot`, and
 * convergence summary) for Cloud AI workflows (`cloud-submit-pr.sh`) via a
 * single fast `gemini-4-carbon` JSON call (~2-4s), falling back gracefully
 * if `GEMINI_API_KEY` is unavailable.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { callGemini } from './ai-review/lib/gemini.mjs';

const MAX_SPEC_CHARS = 12_000;
const MAX_DIFF_CHARS = 60_000;

export function stripArchKbFromSpec(rawSpec = '') {
  const marker = '## X-Talent 跨專案架構知識庫';
  const idx = rawSpec.indexOf(marker);
  const cleaned = idx >= 0 ? rawSpec.slice(0, idx) : rawSpec;
  return cleaned.trim().slice(0, MAX_SPEC_CHARS);
}

export function extractExistingEvidenceUrls(markdown = '') {
  const text = String(markdown ?? '');
  const screenshotMatch = text.match(
    /##\s*Screenshot\b([\s\S]*?)(?=\n##\s+|\nRef:\s+|$)/i
  );
  const scope = screenshotMatch ? screenshotMatch[1] : text;

  const urls = [];
  const seen = new Set();
  const urlRegex =
    /https:\/\/(?:raw\.githubusercontent\.com|github\.com\/user-attachments\/assets|(?:private-)?user-images\.githubusercontent\.com)\/[^\s)"'>]+/gi;
  let match;
  while ((match = urlRegex.exec(scope)) !== null) {
    const url = match[0].trim();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

export function sanitizeImageAlt(text = '') {
  return String(text ?? '')
    .replace(/[\[\]\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function humanizeEvidenceSlug(url = '', index = 0) {
  try {
    const fileName = decodeURIComponent(
      new URL(url).pathname.split('/').pop() || ''
    );
    const withoutIndex = fileName
      .replace(/\.(png|jpe?g|webp)$/i, '')
      .replace(/^\d+-/, '');
    const isMobile = /mobile/i.test(withoutIndex);
    const vpLabel = isMobile ? '行動裝置版 (375x812)' : '桌面版 (1280x800)';
    const cleaned = withoutIndex
      .replace(/^(visitor|mentee|mentor)-(desktop|mobile)-/i, '')
      .replace(/^(desktop|mobile)-/i, '')
      .replace(/-(desktop|mobile)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return cleaned
      ? `${vpLabel} — ${cleaned}`
      : `${vpLabel} 畫面證據 #${index + 1}`;
  } catch {
    return `畫面證據 #${index + 1}`;
  }
}

export function ensurePrTitleTag(rawTitle, branch, ticket) {
  let title = String(rawTitle || '').trim();
  if (!title) {
    const prefix = branch.startsWith('fix/') ? 'fix' : 'feat';
    const slug = branch
      .replace(/^(feat|fix|chore|refactor|test)\//, '')
      .replace(/^\d+-/, '')
      .replace(/-/g, ' ')
      .trim();
    title = `${prefix}: ${slug || 'update implementation'}`;
  }
  // Remove accidental trailing period
  title = title.replace(/\.\s*$/, '');
  if (ticket) {
    // Strip existing (#123) or (X-Tracker #123) at the end and normalize to (X-Tracker #<ticket>)
    title = title.replace(/\s*\((?:X-Tracker\s*)?#\d+\)\s*$/i, '').trim();
    title = `${title} (X-Tracker #${ticket})`;
  }
  return title;
}

export function buildPrDescriptionPrompt({
  ticket,
  branch,
  specExcerpt,
  diffFiles,
  diffText,
  evidenceUrls,
}) {
  const evidenceHint =
    evidenceUrls.length > 0
      ? evidenceUrls
          .map(
            (u, i) =>
              `${i + 1}. 檔名：${u.split('/').pop()}（預設標籤：${humanizeEvidenceSlug(u, i)}）`
          )
          .join('\n')
      : '（無截圖）';

  return [
    '你是一位資深前端工程師，請根據下方的 Ticket 規格與實際 `git diff`，撰寫清楚、具體、讓團隊一眼看懂「這個 PR 到底做了什麼與為什麼這樣做」的繁體中文 PR 說明（不要只列檔案清單！）。',
    '',
    `分支名稱：\`${branch}\``,
    ticket ? `對應 Ticket：X-Talent-Tracker #${ticket}` : '對應 Ticket：無',
    '',
    '### Ticket 需求摘要',
    specExcerpt || '（無 Ticket 文字，請直接依據 git diff 歸納）',
    '',
    '### 變更檔案清單',
    diffFiles.map((f) => `- ${f}`).join('\n') || '（無）',
    '',
    '### 已擷取之畫面證據檔名清單',
    evidenceHint,
    '',
    '### Git Diff 內容',
    '```diff',
    diffText,
    '```',
    '',
    '請只回傳符合以下結構的 JSON 物件（不要加 Markdown code fence 或額外文字）：',
    JSON.stringify(
      {
        prTitle:
          '英文 Conventional Commit 標題，例如 feat(mentor-pool): display average rating and completed sessions on mentor cards（不含票號後綴，系統會自動補上）',
        overview:
          '1 到 2 句繁體中文總結：明確說明本 PR 解決了什麼產品需求或問題、涵蓋哪些畫面與核心互動行為。',
        moduleHighlights: [
          {
            title:
              '繁體中文重點標題（例如：導師卡片方案 B 評分與完成場次排版）',
            files: ['src/components/mentor-pool/mentor-card/Information.tsx'],
            details: [
              '具體說明實作了什麼業務規則、UI 狀態切換、邊界防呆（如 0 則評價隱藏、未上線 API fallback 等）',
            ],
          },
        ],
        demoRoutes: ['/mentor-pool'],
        screenshotCaptions: [
          '針對上方每一張截圖檔名，寫出對應的一行繁體中文情境標題（數量需與已擷取截圖數量一致；若無截圖則回傳空陣列）',
        ],
      },
      null,
      2
    ),
  ].join('\n');
}

export function renderPrMarkdown({
  ticket,
  branch,
  generated,
  diffFiles = [],
  evidenceUrls = [],
  summaryText = '',
}) {
  const overview = String(generated?.overview || '').trim();
  const highlights = Array.isArray(generated?.moduleHighlights)
    ? generated.moduleHighlights.filter(
        (h) =>
          h && (h.title || (Array.isArray(h.details) && h.details.length > 0))
      )
    : [];

  const whatParts = ['## What Does This PR Do?', ''];

  if (overview) {
    whatParts.push(overview, '');
  }

  if (highlights.length > 0) {
    highlights.forEach((item, idx) => {
      const filesTag =
        Array.isArray(item.files) && item.files.length > 0
          ? ` (${item.files
              .slice(0, 4)
              .map((f) => `\`${f}\``)
              .join(', ')})`
          : '';
      whatParts.push(
        `${idx + 1}. **${item.title || '模組變更'}**${filesTag}：`
      );
      const details = Array.isArray(item.details) ? item.details : [];
      for (const line of details) {
        if (String(line || '').trim()) {
          whatParts.push(`   - ${String(line).trim()}`);
        }
      }
    });
  } else if (diffFiles.length > 0) {
    // Fallback grouped summary when Gemini API is unavailable
    const uiFiles = diffFiles.filter(
      (f) =>
        (f.startsWith('src/app/') || f.startsWith('src/components/')) &&
        !f.includes('.test.') &&
        !f.includes('.stories.')
    );
    const dataFiles = diffFiles.filter(
      (f) =>
        (f.startsWith('src/services/') ||
          f.startsWith('src/hooks/') ||
          f.startsWith('src/lib/') ||
          f.startsWith('src/types/')) &&
        !f.includes('.test.')
    );
    const testAndStoryFiles = diffFiles.filter(
      (f) =>
        f.includes('.test.') || f.includes('.stories.') || f.startsWith('e2e/')
    );

    if (uiFiles.length > 0) {
      whatParts.push(
        `- **畫面與 UI 元件實作**：更新 ${uiFiles.map((f) => `\`${f}\``).join('、')}。`
      );
    }
    if (dataFiles.length > 0) {
      whatParts.push(
        `- **資料轉換、狀態與型別定義**：更新 ${dataFiles.map((f) => `\`${f}\``).join('、')}。`
      );
    }
    if (testAndStoryFiles.length > 0) {
      whatParts.push(
        `- **Storybook 與自動化測試覆蓋**：補齊 ${testAndStoryFiles
          .slice(0, 8)
          .map((f) => `\`${f}\``)
          .join('、')}。`
      );
    }
    if (
      uiFiles.length === 0 &&
      dataFiles.length === 0 &&
      testAndStoryFiles.length === 0
    ) {
      for (const f of diffFiles.slice(0, 20)) {
        whatParts.push(`- \`${f}\``);
      }
    }
  } else {
    whatParts.push(`- Branch \`${branch}\``);
  }

  const demoRoutes = Array.isArray(generated?.demoRoutes)
    ? generated.demoRoutes.map((r) => String(r || '').trim()).filter(Boolean)
    : [];
  if (demoRoutes.length > 0) {
    whatParts.push('', '## Demo', '');
    for (const route of demoRoutes) {
      whatParts.push(`- \`${route}\``);
    }
  }

  whatParts.push('', '## Screenshot', '');
  const captions = Array.isArray(generated?.screenshotCaptions)
    ? generated.screenshotCaptions
    : [];
  if (evidenceUrls.length > 0) {
    evidenceUrls.forEach((url, idx) => {
      const caption =
        String(captions[idx] || '')
          .replace(/[\r\n]+/g, ' ')
          .trim() || humanizeEvidenceSlug(url, idx);
      const safeAlt = sanitizeImageAlt(caption) || `evidence-${idx + 1}`;
      whatParts.push(`### ${idx + 1}. ${caption}`, `![${safeAlt}](${url})`, '');
    });
  } else {
    whatParts.push('N/A (Automated by CI PR Preview)', '');
  }

  if (summaryText) {
    whatParts.push(summaryText.trim(), '');
  }

  if (ticket) {
    whatParts.push(
      `Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/${ticket}`
    );
  }

  return `${whatParts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function parseCliArgs(argv = []) {
  const get = (prefix) => {
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : '';
  };
  return {
    ticket: get('--ticket=').replace(/^#/, '').trim(),
    branch: get('--branch=').trim(),
    lastSubject: get('--last-subject=').trim(),
    specFile: get('--spec-file=').trim(),
    summaryFile: get('--summary-file=').trim(),
    evidenceFile: get('--evidence-file=').trim(),
    existingBodyFile: get('--existing-body-file=').trim(),
    baseRef: get('--base-ref=').trim() || 'origin/develop',
    titleOut: get('--title-out=').trim(),
    bodyOut: get('--body-out=').trim(),
  };
}

export async function runGeneratePrDescription(opts = {}) {
  const {
    ticket = '',
    branch = '',
    lastSubject = '',
    specFile = '',
    summaryFile = '',
    evidenceFile = '',
    existingBodyFile = '',
    baseRef = 'origin/develop',
    titleOut = '',
    bodyOut = '',
    callGeminiImpl = callGemini,
  } = opts;

  const rawSpec =
    specFile && fs.existsSync(specFile)
      ? fs.readFileSync(specFile, 'utf8')
      : '';
  const specExcerpt = stripArchKbFromSpec(rawSpec);

  const summaryText =
    summaryFile && fs.existsSync(summaryFile)
      ? fs.readFileSync(summaryFile, 'utf8').trim()
      : '';

  let evidenceUrls =
    evidenceFile && fs.existsSync(evidenceFile)
      ? fs
          .readFileSync(evidenceFile, 'utf8')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  let resolvedTicket = ticket;
  let existingBody = '';
  if (existingBodyFile && fs.existsSync(existingBodyFile)) {
    existingBody = fs.readFileSync(existingBodyFile, 'utf8');
    if (!resolvedTicket) {
      const ticketMatch = existingBody.match(
        /X-Talent-Tracker\/issues\/(\d+)|\(X-Tracker\s*#(\d+)\)/i
      );
      resolvedTicket = ticketMatch?.[1] || ticketMatch?.[2] || '';
    }
  }

  if (evidenceUrls.length === 0 && existingBody) {
    evidenceUrls = extractExistingEvidenceUrls(existingBody);
  }

  let diffFiles = [];
  let diffText = '';
  try {
    const namesRaw = execFileSync(
      'git',
      ['diff', '--name-only', `${baseRef}...HEAD`],
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );
    diffFiles = namesRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const fullDiff = execFileSync('git', ['diff', `${baseRef}...HEAD`], {
      encoding: 'utf8',
      maxBuffer: 12 * 1024 * 1024,
    });
    diffText = fullDiff.slice(0, MAX_DIFF_CHARS);
  } catch {
    // Fallback if git diff fails in isolated test context
  }

  let generated = null;
  if (process.env.GEMINI_API_KEY && (diffText || specExcerpt)) {
    try {
      const prompt = buildPrDescriptionPrompt({
        ticket: resolvedTicket,
        branch,
        specExcerpt,
        diffFiles,
        diffText,
        evidenceUrls,
      });
      generated = await callGeminiImpl(prompt, { maxOutputTokens: 8192 });
    } catch (err) {
      console.warn(
        `[generate-pr-description] Gemini synthesis skipped (${err.message}); using grouped fallback.`
      );
    }
  }

  const rawTitleCandidate = generated?.prTitle || lastSubject;
  const finalTitle = ensurePrTitleTag(
    rawTitleCandidate,
    branch,
    resolvedTicket
  );
  const finalBody = renderPrMarkdown({
    ticket: resolvedTicket,
    branch,
    generated,
    diffFiles,
    evidenceUrls,
    summaryText,
  });

  if (titleOut) {
    fs.writeFileSync(titleOut, finalTitle, 'utf8');
  }
  if (bodyOut) {
    fs.writeFileSync(bodyOut, finalBody, 'utf8');
  }

  return { title: finalTitle, body: finalBody };
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const args = parseCliArgs(process.argv.slice(2));
  runGeneratePrDescription(args).catch((err) => {
    console.error('[generate-pr-description] Error:', err.message);
    process.exit(1);
  });
}
