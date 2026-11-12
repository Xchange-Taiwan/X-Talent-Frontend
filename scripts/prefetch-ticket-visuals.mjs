#!/usr/bin/env node
/**
 * Pre-fetches visual design & motion/micro-interaction references for Cloud AI VM
 * workflows (`cloud-implement.yml` and `cloud-fix-pr.yml`) so headless Gemini CLI
 * and Pre-PR AI Review have real multimodal vision AND exact CSS/JS animation specs:
 *
 * 1. Downloads private GitHub Issue & Comment images from `X-Talent-Tracker`
 *    (prioritizing Top Issue Description first, then newest comments first)
 *    using `Accept: application/vnd.github.full+json` (`body_html` signed JWT URLs),
 *    validating image magic bytes so HTML login redirects are never saved as PNGs.
 * 2. Captures live Light Mode Playwright screenshots (unwrapping `#hub-frame`
 *    iframes on Design Hub and waiting for scenario boot) + computed DOM/CSS
 *    summaries + `@keyframes` / `transition` / `transform` / `animate()` motion
 *    rules for public Design Hub (`*.workers.dev`) and prototype (`*.chatgpt.site`) URLs.
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
const MAX_PROTOTYPE_URLS = 6;
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
 * Orders issue + comment blocks so Top Issue Description (Single Source of Truth)
 * comes first, followed by comments in reverse-chronological order (newest first),
 * ensuring recent design updates are never crowded out by old historical mockups.
 */
export function prioritizeIssueAndCommentBlocks(issue, comments = []) {
  const ordered = [];
  if (issue) {
    ordered.push({ ...issue, _fromComment: false });
  }
  if (Array.isArray(comments) && comments.length > 0) {
    for (let i = comments.length - 1; i >= 0; i--) {
      if (comments[i]) {
        ordered.push({ ...comments[i], _fromComment: true });
      }
    }
  }
  return ordered;
}

/**
 * Extracts allowed ticket image URLs from GitHub API `body_html` + `body` blocks,
 * prioritizing signed `private-user-images.githubusercontent.com` JWT URLs.
 */
export function extractTicketImageCandidates(blocks = []) {
  const byKey = new Map();

  const recordCandidate = (rawUrl, altText = '', fromComment = false) => {
    const url = decodeHtmlEntities(rawUrl).trim();
    if (!isAllowedTicketImageUrl(url)) return;
    const key = getAssetDedupKey(url);
    const isSigned = isSignedUserImageHost(url);
    const existing = byKey.get(key);
    const cleanAlt = altText.trim();
    const decoratedAlt = fromComment
      ? existing?.alt ||
        `${cleanAlt ? `${cleanAlt} ` : ''}(留言附圖，若與頂部最新規格衝突請以頂部規格與 Design Hub 為準)`.trim()
      : cleanAlt || existing?.alt || '';
    if (!existing || (isSigned && !existing.isSigned)) {
      byKey.set(key, {
        url,
        alt: decoratedAlt,
        isSigned,
      });
    }
  };

  for (const block of blocks) {
    const html = String(block?.body_html ?? '');
    const md = String(block?.body ?? '');
    const fromComment = Boolean(block?._fromComment);

    // 1. HTML <img> tags from body_html (contains signed JWT URLs for private repos)
    const imgTagRegex = /<img\b[^>]*>/gi;
    let tagMatch;
    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        recordCandidate(srcMatch[1], altMatch?.[1] ?? '', fromComment);
      }
    }

    // 2. Fallback: raw markdown ![alt](url) and inline <img src="..."> in body
    const mdImgRegex = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g;
    let mdMatch;
    while ((mdMatch = mdImgRegex.exec(md)) !== null) {
      recordCandidate(mdMatch[2], mdMatch[1], fromComment);
    }
    while ((tagMatch = imgTagRegex.exec(md)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        recordCandidate(srcMatch[1], altMatch?.[1] ?? '', fromComment);
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

  // Also check Design Hub KB for standalone module HTML pages & scenarios matching this ticket
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
        // Expand key Design Hub interactive scenarios (e.g. form, rating, failure) when present
        if (screen?.id && Array.isArray(screen?.scenarios)) {
          for (const sc of screen.scenarios.slice(0, 4)) {
            if (!sc?.id) continue;
            const scUrl = `${DESIGN_HUB_BASE_URL}/?view=screens&screen=${encodeURIComponent(screen.id)}&device=desktop&scenario=${encodeURIComponent(sc.id)}&mode=play`;
            if (isAllowedPrototypeUrl(scUrl) && !seenProto.has(scUrl)) {
              seenProto.add(scUrl);
              prototypeUrls.push(scUrl);
            }
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
 * Extracts CSS @keyframes, transition, transform, backdrop-filter, and JS
 * Web Animations API (`animate([...])`) rules from raw stylesheet/script text
 * so headless AI agents can faithfully reproduce motion & micro-interactions.
 */
export function extractMotionRulesFromCode(cssTexts = [], jsTexts = []) {
  const keyframes = [];
  const transitionsAndTransforms = [];
  const webAnimations = [];

  for (const rawCss of cssTexts) {
    const withoutComments = String(rawCss ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/data:image\/[^"')\s]+/g, 'DATA_IMAGE');
    const kfRegex =
      /@keyframes\s+[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    let kfMatch;
    while (
      (kfMatch = kfRegex.exec(withoutComments)) !== null &&
      keyframes.length < 15
    ) {
      keyframes.push(kfMatch[0].trim());
    }

    // Strip @keyframes and @media (...prefers-reduced-motion...) blocks before rule scanning
    const cleanedRulesCss = withoutComments
      .replace(kfRegex, ' ')
      .replace(
        /@media[^{]*prefers-reduced-motion[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi,
        ' '
      );

    const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g;
    let ruleMatch;
    while (
      (ruleMatch = ruleRegex.exec(cleanedRulesCss)) !== null &&
      transitionsAndTransforms.length < 30
    ) {
      const sel = ruleMatch[1].trim().replace(/\s+/g, ' ');
      const decls = ruleMatch[2].trim();
      if (
        /(?:transition|animation|transform|backdrop-filter)\s*:/i.test(decls) &&
        !/!\s*important\b/i.test(decls) &&
        sel.length > 0 &&
        sel.length < 140
      ) {
        const relevantProps = decls
          .split(';')
          .map((d) => d.trim())
          .filter((d) =>
            /^(?:transition|animation|transform|backdrop-filter|opacity|inset|z-index|background|border|color|box-shadow)\b/i.test(
              d
            )
          )
          .join('; ');
        if (relevantProps) {
          transitionsAndTransforms.push(`${sel} { ${relevantProps}; }`);
        }
      }
    }
  }

  for (const rawJs of jsTexts) {
    const js = String(rawJs ?? '').replace(
      /data:image\/[^"')\s]+/g,
      'DATA_IMAGE'
    );
    const animRegex = /(?:\.\s*animate|\bmotion)\s*\([^;]{10,360}\)/g;
    let animMatch;
    while (
      (animMatch = animRegex.exec(js)) !== null &&
      webAnimations.length < 12
    ) {
      webAnimations.push(animMatch[0].trim());
    }
  }

  return {
    keyframes: [...new Set(keyframes)],
    transitionsAndTransforms: [...new Set(transitionsAndTransforms)],
    webAnimations: [...new Set(webAnimations)],
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

async function capturePrototypesWithPlaywright(urls, outDir, rawSpecText = '') {
  if (!urls || urls.length === 0) return [];
  let chromium;
  try {
    const pw = await import('@playwright/test');
    chromium = pw.chromium;
  } catch {
    return [];
  }

  const interactiveTabLabels = [];
  if (/(?:評價|評論|回饋)/i.test(rawSpecText)) {
    interactiveTabLabels.push('評價');
  }
  if (/(?:尚無評價|空狀態|沒有評價)/i.test(rawSpecText)) {
    interactiveTabLabels.push('尚無評價');
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
          settleDelayMs: 400,
        });

        // If Design Hub wraps a screen inside an iframe (#hub-frame), allow extra
        // boot time so scenario auto-actions (opening modal / step 2 / toast) settle.
        const hasIframe = await page
          .locator('iframe')
          .count()
          .catch(() => 0);
        if (hasIframe > 0) {
          await page.waitForTimeout(1200);
        }

        const pageSummary = await page.evaluate(() => {
          const iframeEl = document.querySelector('iframe');
          let targetDoc = document;
          let targetWin = window;
          let iframeClip = null;
          if (iframeEl) {
            const rect = iframeEl.getBoundingClientRect();
            if (rect.width >= 360 && rect.height >= 360) {
              iframeClip = {
                x: Math.max(0, Math.round(rect.left)),
                y: Math.max(0, Math.round(rect.top)),
                width: Math.round(rect.width),
                height: Math.min(900, Math.round(rect.height)),
              };
            }
            try {
              if (
                iframeEl.contentDocument?.body &&
                (iframeEl.contentDocument.body.innerText || '').trim().length >
                  15
              ) {
                targetDoc = iframeEl.contentDocument;
                targetWin = iframeEl.contentWindow || window;
              }
            } catch {
              // Cross-origin iframe fallback to outer document
            }
          }

          const bodyText = (targetDoc.body?.innerText || '').trim();
          if (
            bodyText.length < 15 ||
            bodyText === '載入中...' ||
            /just a moment|verify you are human/i.test(bodyText)
          ) {
            return { usable: false, title: document.title, elements: [] };
          }

          const pickStyle = (el) => {
            const cs = targetWin.getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || undefined,
              ariaLabel: el.getAttribute('aria-label') || undefined,
              tooltip: el.getAttribute('data-tooltip') || undefined,
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
              transform: cs.transform !== 'none' ? cs.transform : undefined,
              transition:
                cs.transition && cs.transition !== 'all 0s ease 0s'
                  ? cs.transition.slice(0, 120)
                  : undefined,
            };
          };

          const nodes = Array.from(
            targetDoc.querySelectorAll(
              'h1, h2, h3, [role="dialog"], [role="tab"], [role="tooltip"], button, label, nav a, [class*="card" i], [class*="dialog" i], [class*="badge" i], [class*="back" i], [class*="toast" i], [class*="summary" i]'
            )
          )
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top < 1800;
            })
            .slice(0, 45)
            .map(pickStyle);

          const styleTexts = Array.from(targetDoc.querySelectorAll('style')).map(
            (s) => s.textContent || ''
          );
          const scriptTexts = Array.from(
            targetDoc.querySelectorAll('script:not([src])')
          ).map((s) => s.textContent || '');

          return {
            usable: true,
            title: targetDoc.title || document.title || '',
            textPreview: bodyText.slice(0, 1400),
            elements: nodes,
            styleTexts,
            scriptTexts,
            iframeClip,
          };
        });

        if (!pageSummary.usable) {
          continue;
        }

        const motionRules = extractMotionRulesFromCode(
          pageSummary.styleTexts,
          pageSummary.scriptTexts
        );

        const baseName = `prototype-${String(idx + 1).padStart(2, '0')}`;
        const imgPath = path.join(outDir, `${baseName}.png`);
        const domPath = path.join(outDir, `${baseName}-dom.md`);

        const clipRegion = pageSummary.iframeClip || {
          x: 0,
          y: 0,
          width: 1280,
          height: 900,
        };
        await page.screenshot({
          path: imgPath,
          clip: clipRegion,
        });

        const domLines = [
          `# 互動原型視覺、微互動與動態樣式摘要 (${url})`,
          '',
          `- 頁面標題：${pageSummary.title || '(無)'}`,
          `- 對應截圖：\`${imgPath.replace(/\\/g, '/')}\``,
          '',
          '## 畫面可見文案摘要',
          '```text',
          pageSummary.textPreview,
          '```',
          '',
          '## 關鍵元件 Computed Style 抽樣（含 transform / transition / tooltip）',
          '```json',
          JSON.stringify(pageSummary.elements, null, 2),
          '```',
          '',
        ];

        if (
          motionRules.keyframes.length > 0 ||
          motionRules.transitionsAndTransforms.length > 0 ||
          motionRules.webAnimations.length > 0
        ) {
          domLines.push(
            '## 動態過渡與微互動 CSS/JS 規則 (@keyframes / transition / transform / animate)',
            '```css',
            ...motionRules.keyframes,
            ...motionRules.transitionsAndTransforms,
            '```'
          );
          if (motionRules.webAnimations.length > 0) {
            domLines.push(
              '```js',
              ...motionRules.webAnimations,
              '```'
            );
          }
          domLines.push('');
        }

        fs.writeFileSync(domPath, domLines.join('\n'), 'utf8');

        captured.push({
          url,
          title: pageSummary.title,
          imagePath: imgPath.replace(/\\/g, '/'),
          domSpecPath: domPath.replace(/\\/g, '/'),
          mimeType: 'image/png',
        });

        // If the ticket targets specific tabs/states (e.g. '評價', '尚無評價'),
        // click them inside the prototype so Gemini sees the exact active tab UI!
        for (let tIdx = 0; tIdx < interactiveTabLabels.length; tIdx++) {
          const tabKw = interactiveTabLabels[tIdx];
          try {
            const clicked = await page.evaluate((kw) => {
              const iframeEl = document.querySelector('iframe');
              let doc = document;
              try {
                if (iframeEl?.contentDocument?.body) {
                  doc = iframeEl.contentDocument;
                }
              } catch {
                // ignore cross-origin
              }
              const candidates = Array.from(
                doc.querySelectorAll('[role="tab"], button')
              ).filter((el) => {
                if (!(el instanceof doc.defaultView.HTMLElement)) return false;
                if (el.dataset.prefetchClicked === '1') return false;
                if (el.getClientRects().length === 0) return false;
                const txt = (el.textContent || '').trim();
                if (!txt || txt.length > 18 || !txt.includes(kw)) return false;
                if (kw === '評價' && /(?:尚無評價|沒有評價|無評價)/.test(txt)) {
                  return false;
                }
                return true;
              });
              candidates.sort((a, b) => {
                const aTab = a.getAttribute('role') === 'tab' ? 0 : 1;
                const bTab = b.getAttribute('role') === 'tab' ? 0 : 1;
                return aTab - bTab;
              });
              const target = candidates[0];
              if (target) {
                target.dataset.prefetchClicked = '1';
                target.click();
                return (target.textContent || '').trim();
              }
              return '';
            }, tabKw);

            if (clicked) {
              await waitForUiSettled(page, { settleDelayMs: 300 });
              const tabImgPath = path.join(
                outDir,
                `${baseName}-tab-${tIdx + 1}.png`
              );
              await page.screenshot({
                path: tabImgPath,
                clip: clipRegion,
              });
              captured.push({
                url: `${url} (切換狀態: ${clicked})`,
                title: `${pageSummary.title} - ${clicked}`,
                imagePath: tabImgPath.replace(/\\/g, '/'),
                domSpecPath: domPath.replace(/\\/g, '/'),
                mimeType: 'image/png',
              });
            }
          } catch {
            // Ignore optional tab click errors
          }
        }
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
    '## Ticket 視覺參考圖檔、微互動與 Design Hub 原型快照（已預先下載至本地）',
    '',
    '> **重要視覺與動態對齊指示**：動手寫 UI 元件前，**請務必先使用 `read_file` 工具逐一檢視下方列出的本地 `.png` / `.jpg` / `.webp` 圖檔與 `-dom.md` 樣式／動畫摘要**，確保排版結構、欄位順序、字級顏色、收合展開互動、Tooltip、彈窗進場與步驟切換過渡動畫、以及多張卡片傾斜疊放動態 1:1 對齊設計稿，切勿僅憑文字猜測排版或省略動畫！',
    '',
  ];

  if (downloadedImages.length > 0) {
    lines.push('### 1. Ticket 與留言附圖（依頂部最新規格優先排序）');
    for (const img of downloadedImages) {
      lines.push(
        `- \`${img.path}\`${img.alt ? ` — 說明：${img.alt}` : ''} (${img.mimeType})`
      );
    }
    lines.push('');
  }

  if (capturedPrototypes.length > 0) {
    lines.push(
      '### 2. Design Hub / 互動原型即時截圖、Computed CSS 與 `@keyframes` 動態規則'
    );
    for (const proto of capturedPrototypes) {
      lines.push(
        `- 原型截圖：\`${proto.imagePath}\`（來源：${proto.url}）`,
        `  - 對應 DOM、CSS 數值與動態過渡規則摘要：\`${proto.domSpecPath}\``
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
    blocks = prioritizeIssueAndCommentBlocks(issue, comments);
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
    : await capturePrototypesWithPlaywright(
        prototypeUrls,
        outDir,
        rawTexts.join('\n')
      );

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
