#!/usr/bin/env node
/**
 * Pre-fetches visual design references for Cloud AI VM workflows
 * (`cloud-implement.yml` and `cloud-fix-pr.yml`) so headless Gemini CLI and
 * Pre-PR AI Review have real multimodal vision:
 *
 * 1. Downloads private GitHub Issue & Comment images from `X-Talent-Tracker`
 *    using `Accept: application/vnd.github.full+json` (`body_html` signed JWT URLs),
 *    validating image magic bytes so HTML login redirects are never saved as PNGs.
 * 2. Captures live Light Mode Playwright screenshots + computed DOM/CSS summaries
 *    for public Design Hub (`*.workers.dev`) and interactive prototype (`*.chatgpt.site`) URLs.
 * 3. Appends a structured local file manifest to `.agents/tmp/ticket-spec.md`
 *    and writes `.agents/tmp/visual-manifest.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { waitForUiSettled } from './ui-settle.mjs';

const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';
const DESIGN_HUB_KB_URL =
  'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Design-Hub/main/public/design-hub-kb.json';
const DESIGN_HUB_BASE_URL = 'https://x-talent-design-hub.x-talent.workers.dev';

const MAX_TICKET_IMAGES = 8;
const MAX_PROTOTYPE_URLS = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_HOSTS = new Set([
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
  'github-production-user-asset-6210df.s3.amazonaws.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.com',
]);

const ALLOWED_PROTOTYPE_EXACT_HOSTS = new Set([
  'x-talent-design-hub.x-talent.workers.dev',
  'x-talent-design-hub-preview.x-talent.workers.dev',
  'x-talent-storybook.x-talent.workers.dev',
]);

/**
 * Inspects binary magic bytes to confirm a buffer is a genuine raster image
 * (preventing HTML login pages or 404 XML responses from poisoning Gemini inlineData).
 */
export function sniffImageMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', ext: '.png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: '.jpg' };
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mimeType: 'image/gif', ext: '.gif' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: '.webp' };
  }

  return null;
}

export function isAllowedTicketImageUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl ?? '').trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_IMAGE_HOSTS.has(host)) return false;
    if (host === 'github.com') {
      return (
        /^\/user-attachments\/assets\/[a-zA-Z0-9-]+/.test(parsed.pathname) ||
        /^\/[^/]+\/[^/]+\/assets\/[0-9]+\/[a-zA-Z0-9-]+/.test(parsed.pathname)
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function isAllowedPrototypeUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl ?? '').trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_PROTOTYPE_EXACT_HOSTS.has(host)) return true;
    if (
      host.endsWith('.chatgpt.site') &&
      host.length > '.chatgpt.site'.length
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Normalizes an asset URL to a stable deduplication key (e.g. UUID) so the same
 * attachment referenced in both `body_html` and `body` is downloaded only once,
 * preferring signed `private-user-images` URLs over cookie-gated `github.com` URLs.
 */
export function getAssetDedupKey(rawUrl) {
  const str = String(rawUrl ?? '').trim();
  const uuidMatch = str.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) {
    return `uuid:${uuidMatch[0].toLowerCase()}`;
  }
  try {
    const u = new URL(str);
    return `${u.origin}${u.pathname}`;
  } catch {
    return str;
  }
}

function decodeHtmlEntities(str) {
  return String(str ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isSignedUserImageHost(rawUrl) {
  try {
    return (
      new URL(rawUrl).hostname.toLowerCase() ===
      'private-user-images.githubusercontent.com'
    );
  } catch {
    return false;
  }
}

/**
 * Extracts allowed ticket image URLs from GitHub API `body_html` + `body` blocks,
 * prioritizing signed `private-user-images.githubusercontent.com` JWT URLs.
 */
export function extractTicketImageCandidates(blocks = []) {
  const byKey = new Map();

  const recordCandidate = (rawUrl, altText = '') => {
    const url = decodeHtmlEntities(rawUrl).trim();
    if (!isAllowedTicketImageUrl(url)) return;
    const key = getAssetDedupKey(url);
    const isSigned = isSignedUserImageHost(url);
    const existing = byKey.get(key);
    if (!existing || (isSigned && !existing.isSigned)) {
      byKey.set(key, {
        url,
        alt: altText.trim() || existing?.alt || '',
        isSigned,
      });
    }
  };

  for (const block of blocks) {
    const html = String(block?.body_html ?? '');
    const md = String(block?.body ?? '');

    // 1. HTML <img> tags from body_html (contains signed JWT URLs for private repos)
    const imgTagRegex = /<img\b[^>]*>/gi;
    let tagMatch;
    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        recordCandidate(srcMatch[1], altMatch?.[1] ?? '');
      }
    }

    // 2. Fallback: raw markdown ![alt](url) and inline <img src="..."> in body
    const mdImgRegex = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g;
    let mdMatch;
    while ((mdMatch = mdImgRegex.exec(md)) !== null) {
      recordCandidate(mdMatch[2], mdMatch[1]);
    }
    while ((tagMatch = imgTagRegex.exec(md)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        recordCandidate(srcMatch[1], altMatch?.[1] ?? '');
      }
    }
  }

  return Array.from(byKey.values()).slice(0, MAX_TICKET_IMAGES);
}

/**
 * Extracts public Design Hub / prototype URLs from ticket text and notes any
 * non-automatable links (Figma / Claude Artifacts) so the manifest explains them clearly.
 */
export function extractDesignUrlsFromTexts(
  texts = [],
  ticketNumber = '',
  designHubKb = null
) {
  const prototypeUrls = [];
  const seenProto = new Set();
  const skippedProtectedUrls = [];
  const seenSkipped = new Set();

  const urlRegex = /https:\/\/[^\s)<>"'`\]]+/g;

  for (const text of texts) {
    const raw = String(text ?? '');
    let match;
    while ((match = urlRegex.exec(raw)) !== null) {
      const cleaned = match[0].replace(/[.,;:!?]+$/, '');
      if (isAllowedPrototypeUrl(cleaned)) {
        if (!seenProto.has(cleaned)) {
          seenProto.add(cleaned);
          prototypeUrls.push(cleaned);
        }
      } else if (
        /^https:\/\/(www\.)?figma\.com\//i.test(cleaned) ||
        /^https:\/\/claude\.ai\/artifact\//i.test(cleaned)
      ) {
        if (!seenSkipped.has(cleaned)) {
          seenSkipped.add(cleaned);
          skippedProtectedUrls.push(cleaned);
        }
      }
    }
  }

  // Also check Design Hub KB for standalone module HTML pages matching this ticket
  if (designHubKb && ticketNumber) {
    const cleanNum = String(ticketNumber).replace(/^#/, '').trim();
    const screens = Array.isArray(designHubKb.screens)
      ? designHubKb.screens
      : [];
    for (const screen of screens) {
      if (screen?.module === 'frontend') continue; // skip chunk-broken frontend shell
      const screenTickets = Array.isArray(screen?.tickets)
        ? screen.tickets.map((t) => String(t).replace(/^#/, ''))
        : [];
      const candidateUrls = [
        screen?.hubUrl,
        screen?.sourceUrl,
        screen?.path,
        screen?.url,
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      const matchesTicket =
        screenTickets.includes(cleanNum) ||
        String(screen?.id || '').includes(cleanNum) ||
        candidateUrls.some((u) => u.includes(cleanNum));
      if (matchesTicket) {
        for (const rawCandidate of candidateUrls) {
          const fullUrl = rawCandidate.startsWith('http')
            ? rawCandidate
            : `${DESIGN_HUB_BASE_URL}/${rawCandidate.replace(/^\/+/, '')}`;
          if (isAllowedPrototypeUrl(fullUrl) && !seenProto.has(fullUrl)) {
            seenProto.add(fullUrl);
            prototypeUrls.push(fullUrl);
          }
        }
      }
    }
  }

  return {
    prototypeUrls: prototypeUrls.slice(0, MAX_PROTOTYPE_URLS),
    skippedProtectedUrls,
  };
}

/**
 * Downloads an image safely without leaking GitHub Bearer tokens to S3/signed hosts
 * (sending Authorization headers alongside X-Amz-Signature / JWT query params causes HTTP 400).
 */
export async function downloadVerifiedImage(
  rawUrl,
  ghToken = '',
  fetchImpl = fetch
) {
  if (!isAllowedTicketImageUrl(rawUrl)) {
    return null;
  }

  let targetUrl = rawUrl;
  const parsed = new URL(targetUrl);

  // Only github.com attachment endpoints accept/require GitHub token to issue a 302 redirect;
  // signed S3 / githubusercontent URLs must NOT receive an Authorization header.
  if (parsed.hostname.toLowerCase() === 'github.com' && ghToken) {
    const redirectRes = await fetchImpl(targetUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const loc = redirectRes.headers.get('location');
    if (loc && isAllowedTicketImageUrl(loc)) {
      targetUrl = loc;
    } else if (redirectRes.ok) {
      const buf = Buffer.from(await redirectRes.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) return null;
      const sniffed = sniffImageMimeType(buf);
      return sniffed ? { buffer: buf, ...sniffed } : null;
    } else {
      return null;
    }
  }

  const res = await fetchImpl(targetUrl, {
    headers: { Accept: 'image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;

  if (res.url && !isAllowedTicketImageUrl(res.url)) {
    return null;
  }

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return null;
  }

  const sniffed = sniffImageMimeType(buffer);
  if (!sniffed) {
    return null;
  }

  return { buffer, ...sniffed };
}

async function fetchIssueWithHtml(ticketNumber, token, fetchImpl = fetch) {
  const headers = {
    Accept: 'application/vnd.github.full+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const baseUrl = `https://api.github.com/repos/${TRACKER_OWNER}/${TRACKER_REPO}/issues/${ticketNumber}`;

  const issueRes = await fetchImpl(baseUrl, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!issueRes.ok) {
    throw new Error(
      `Failed to fetch issue #${ticketNumber} (${issueRes.status})`
    );
  }
  const issue = await issueRes.json();

  const commentsRes = await fetchImpl(`${baseUrl}/comments?per_page=100`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  return {
    issue,
    comments: Array.isArray(comments) ? comments : [],
  };
}

async function fetchDesignHubKb(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(DESIGN_HUB_KB_URL, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function capturePrototypesWithPlaywright(urls, outDir) {
  if (!urls || urls.length === 0) return [];
  let chromium;
  try {
    const pw = await import('@playwright/test');
    chromium = pw.chromium;
  } catch {
    return [];
  }

  const captured = [];
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
    });
    const page = await context.newPage();

    for (let idx = 0; idx < urls.length; idx++) {
      const url = urls[idx];
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitForUiSettled(page, {
          networkIdleTimeoutMs: 4000,
          skeletonTimeoutMs: 5000,
          settleDelayMs: 300,
        });

        const pageSummary = await page.evaluate(() => {
          const bodyText = (document.body?.innerText || '').trim();
          if (
            bodyText.length < 15 ||
            bodyText === '載入中...' ||
            /just a moment|verify you are human/i.test(bodyText)
          ) {
            return { usable: false, title: document.title, elements: [] };
          }

          const pickStyle = (el) => {
            const cs = window.getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || undefined,
              text: (el.innerText || '')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 80),
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              color: cs.color,
              bg:
                cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
                  ? cs.backgroundColor
                  : undefined,
              radius: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
            };
          };

          const nodes = Array.from(
            document.querySelectorAll(
              'h1, h2, h3, [role="tab"], button, nav a, [class*="card" i], [class*="badge" i], [class*="summary" i]'
            )
          )
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top < 1800;
            })
            .slice(0, 35)
            .map(pickStyle);

          return {
            usable: true,
            title: document.title || '',
            textPreview: bodyText.slice(0, 1200),
            elements: nodes,
          };
        });

        if (!pageSummary.usable) {
          continue;
        }

        const baseName = `prototype-${String(idx + 1).padStart(2, '0')}`;
        const imgPath = path.join(outDir, `${baseName}.png`);
        const domPath = path.join(outDir, `${baseName}-dom.md`);

        await page.screenshot({
          path: imgPath,
          clip: { x: 0, y: 0, width: 1280, height: 900 },
        });

        const domLines = [
          `# 互動原型視覺與樣式摘要 (${url})`,
          '',
          `- 頁面標題：${pageSummary.title || '(無)'}`,
          `- 對應截圖：\`${imgPath.replace(/\\/g, '/')}\``,
          '',
          '## 畫面可見文案摘要',
          '```text',
          pageSummary.textPreview,
          '```',
          '',
          '## 關鍵元件 Computed Style 抽樣',
          '```json',
          JSON.stringify(pageSummary.elements, null, 2),
          '```',
          '',
        ];
        fs.writeFileSync(domPath, domLines.join('\n'), 'utf8');

        captured.push({
          url,
          title: pageSummary.title,
          imagePath: imgPath.replace(/\\/g, '/'),
          domSpecPath: domPath.replace(/\\/g, '/'),
          mimeType: 'image/png',
        });
      } catch {
        // Non-fatal: skip unreachable prototype URL
      }
    }
  } finally {
    await browser.close();
  }
  return captured;
}

export function formatVisualManifestMarkdown({
  downloadedImages = [],
  capturedPrototypes = [],
  skippedProtectedUrls = [],
}) {
  if (
    downloadedImages.length === 0 &&
    capturedPrototypes.length === 0 &&
    skippedProtectedUrls.length === 0
  ) {
    return '';
  }

  const lines = [
    '',
    '## Ticket 視覺參考圖檔與 Design Hub 原型快照（已預先下載至本地）',
    '',
    '> **重要視覺對齊指示**：動手寫 UI 元件前，**請務必先使用 `read_file` 工具逐一檢視下方列出的本地 `.png` / `.jpg` / `.webp` 圖檔與 `-dom.md` 樣式摘要**，確保排版結構、欄位順序、字級顏色、圓角間距與空狀態 1:1 對齊設計稿，切勿僅憑文字猜測排版！',
    '',
  ];

  if (downloadedImages.length > 0) {
    lines.push('### 1. Ticket 與留言附圖');
    for (const img of downloadedImages) {
      lines.push(
        `- \`${img.path}\`${img.alt ? ` — 說明：${img.alt}` : ''} (${img.mimeType})`
      );
    }
    lines.push('');
  }

  if (capturedPrototypes.length > 0) {
    lines.push('### 2. Design Hub / 互動原型即時截圖與 Computed CSS 結構');
    for (const proto of capturedPrototypes) {
      lines.push(
        `- 原型截圖：\`${proto.imagePath}\`（來源：${proto.url}）`,
        `  - 對應 DOM 與 CSS 數值摘要：\`${proto.domSpecPath}\``
      );
    }
    lines.push('');
  }

  if (skippedProtectedUrls.length > 0) {
    lines.push(
      '### 3. 受登入／驗證保護之外部連結（無法於無頭 VM 直接抓取，請以上方本地截圖與正文規格為準）'
    );
    for (const u of skippedProtectedUrls) {
      lines.push(`- ${u}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function parsePrefetchArgs(argv = [], env = process.env) {
  const getArg = (prefix) => {
    const found = argv.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length).trim() : undefined;
  };
  const rawTicket = (getArg('--ticket=') ?? env.TICKET_NUMBER ?? '')
    .replace(/^#/, '')
    .trim();
  const ticketNumber = /^\d+$/.test(rawTicket) ? rawTicket : '';
  const outDir = getArg('--out-dir=') || '.agents/tmp/ticket-images';
  const specFile = getArg('--spec-file=') || '.agents/tmp/ticket-spec.md';
  const manifestFile =
    getArg('--manifest-file=') || '.agents/tmp/visual-manifest.json';
  const skipPrototypes = getArg('--skip-prototypes=') === 'true';

  return {
    ticketNumber,
    outDir,
    specFile,
    manifestFile,
    skipPrototypes,
  };
}

export async function runPrefetchVisuals(options = {}) {
  const {
    ticketNumber,
    outDir = '.agents/tmp/ticket-images',
    specFile = '.agents/tmp/ticket-spec.md',
    manifestFile = '.agents/tmp/visual-manifest.json',
    skipPrototypes = false,
    ghToken = process.env.TRACKER_READ_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_TOKEN ||
      '',
  } = options;

  if (!ticketNumber) {
    return { downloadedImages: [], capturedPrototypes: [] };
  }

  fs.mkdirSync(outDir, { recursive: true });

  let blocks = [];
  let rawTexts = [];
  try {
    const { issue, comments } = await fetchIssueWithHtml(ticketNumber, ghToken);
    blocks = [issue, ...comments];
    rawTexts = blocks.map((b) => b?.body ?? '');
  } catch (err) {
    console.warn(`[prefetch-visuals] GitHub API fetch skipped: ${err.message}`);
    if (fs.existsSync(specFile)) {
      const fallbackText = fs.readFileSync(specFile, 'utf8');
      blocks = [{ body: fallbackText, body_html: '' }];
      rawTexts = [fallbackText];
    }
  }

  const imageCandidates = extractTicketImageCandidates(blocks);
  const downloadedImages = [];

  for (let i = 0; i < imageCandidates.length; i++) {
    const candidate = imageCandidates[i];
    try {
      const result = await downloadVerifiedImage(candidate.url, ghToken);
      if (!result) continue;
      const fileName = `ticket-img-${String(downloadedImages.length + 1).padStart(2, '0')}${result.ext}`;
      const fullPath = path.join(outDir, fileName);
      fs.writeFileSync(fullPath, result.buffer);
      downloadedImages.push({
        path: fullPath.replace(/\\/g, '/'),
        mimeType: result.mimeType,
        alt: candidate.alt,
      });
    } catch {
      // Skip individual failed image downloads gracefully
    }
  }

  const designHubKb = await fetchDesignHubKb();
  const { prototypeUrls, skippedProtectedUrls } = extractDesignUrlsFromTexts(
    rawTexts,
    ticketNumber,
    designHubKb
  );

  const capturedPrototypes = skipPrototypes
    ? []
    : await capturePrototypesWithPlaywright(prototypeUrls, outDir);

  const manifest = {
    ticketNumber: Number(ticketNumber),
    generatedAt: new Date().toISOString(),
    downloadedImages,
    capturedPrototypes,
    skippedProtectedUrls,
  };

  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

  const markdownAppend = formatVisualManifestMarkdown(manifest);
  if (markdownAppend && fs.existsSync(specFile)) {
    fs.appendFileSync(specFile, `${markdownAppend}\n`, 'utf8');
  }

  console.log(
    `[prefetch-visuals] Ticket #${ticketNumber}: downloaded ${downloadedImages.length} image(s), captured ${capturedPrototypes.length} prototype(s).`
  );
  return manifest;
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const parsed = parsePrefetchArgs(process.argv.slice(2), process.env);
  runPrefetchVisuals(parsed).catch((err) => {
    console.warn(`[prefetch-visuals] Non-fatal error: ${err.message}`);
    process.exit(0);
  });
}
