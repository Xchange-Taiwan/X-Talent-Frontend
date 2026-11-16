#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createDefaultCommandPort,
  redactCredentials,
} from '../../.agents/scripts/tracker-ops.mjs';
import {
  extractTicketNumber,
  fetchFullTicketContext,
  fetchRawArchitectureKb,
  formatArchitectureKnowledgeBase,
} from '../ai-review/lib/ticket.mjs';
import {
  fetchIssueSpecViaGh,
  formatIssueJsonToSpecMarkdown,
} from '../export-ticket-spec.mjs';
import {
  formatVisualManifestMarkdown,
  prioritizeIssueAndCommentBlocks,
  runPrefetchVisuals,
} from '../prefetch-ticket-visuals.mjs';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BT = String.fromCharCode(96);

const SAFE_REPO_SLUG_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function readCachedTicketBundle(
  bundleFile = '.agents/tmp/ticket-bundle.json',
  expectedTicketNumber = null,
  fsImpl = fs
) {
  if (!bundleFile || !fsImpl.existsSync(bundleFile)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(bundleFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.ticketFound === false) {
      return null;
    }
    if (
      expectedTicketNumber &&
      Number(parsed.ticketNumber) !== Number(expectedTicketNumber)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseTicketBundleArgs(argv = [], env = process.env) {
  const getArg = (prefix) => {
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length).trim() : undefined;
  };

  const rawTicket = String(
    getArg('--ticket=') ?? env.TICKET_NUMBER ?? ''
  ).replace(/^#/, '');
  const ticketNumber = /^\d+$/.test(rawTicket.trim()) ? rawTicket.trim() : '';
  const branchName =
    getArg('--branch=') || String(env.BRANCH_NAME || '').trim();
  const prRaw = String(getArg('--pr=') ?? env.PR_NUMBER ?? '').replace(
    /^#/,
    ''
  );
  const prNumber = /^\d+$/.test(prRaw.trim()) ? prRaw.trim() : '';
  const frontendRepo =
    getArg('--frontend-repo=') || String(env.GITHUB_REPOSITORY || '').trim();
  const trackerRepo =
    getArg('--tracker-repo=') || 'Xchange-Taiwan/X-Talent-Tracker';
  const bundleOut = getArg('--bundle-out=') || '.agents/tmp/ticket-bundle.json';
  const specOut = getArg('--spec-out=') || '.agents/tmp/ticket-spec.md';
  const imagesOutDir =
    getArg('--images-out-dir=') || '.agents/tmp/ticket-images';
  const manifestOut =
    getArg('--manifest-out=') || '.agents/tmp/visual-manifest.json';
  const mergeConflictsFile = getArg('--merge-conflicts-file=') || '';
  const skipVisuals = getArg('--skip-visuals=') === 'true';
  const skipPrototypes = getArg('--skip-prototypes=') === 'true';
  const skipKb = getArg('--skip-kb=') === 'true';
  const forceRefresh = getArg('--force-refresh=') === 'true';

  return {
    ticketNumber,
    branchName,
    prNumber,
    frontendRepo,
    trackerRepo,
    bundleOut,
    specOut,
    imagesOutDir,
    manifestOut,
    mergeConflictsFile,
    skipVisuals,
    skipPrototypes,
    skipKb,
    reuseCachedIssue: !forceRefresh,
  };
}

function resolveTrackerToken({ explicitToken, env, port, cwd }) {
  const direct = String(
    explicitToken ||
      env?.TRACKER_READ_TOKEN ||
      env?.GH_TOKEN ||
      env?.GITHUB_TOKEN ||
      ''
  ).trim();
  if (direct) return direct;
  if (port && typeof port.gh === 'function') {
    try {
      return String(port.gh(['auth', 'token'], { cwd, env }) || '').trim();
    } catch {
      return '';
    }
  }
  return '';
}

export function fetchFixPrSupplementalMarkdown({
  prNumber,
  frontendRepo,
  port,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const cleanPr = String(prNumber || '').trim();
  const cleanRepo = String(frontendRepo || '').trim();
  if (
    !cleanPr ||
    !/^\d+$/.test(cleanPr) ||
    !SAFE_REPO_SLUG_RE.test(cleanRepo)
  ) {
    return '';
  }
  const activePort = port || createDefaultCommandPort({ repoRoot: cwd, env });
  const sections = [];

  try {
    const rawCommentsPages = activePort.gh(
      [
        'api',
        '--paginate',
        `repos/${cleanRepo}/issues/${cleanPr}/comments?per_page=100`,
      ],
      { cwd, env }
    );
    const parsedComments = parseConcatenatedJsonArrays(rawCommentsPages);
    const aiReviewComments = parsedComments.filter((c) =>
      String(c?.body || '').includes('ai-review-pipeline')
    );
    const latestAiComment = aiReviewComments.at(-1);
    if (latestAiComment?.body) {
      sections.push(
        [
          '',
          '## 目前 PR 線上 AI Review 審查意見（含 Visual / Design Parity 視覺比對）',
          String(latestAiComment.body).trim(),
        ].join(LF)
      );
    }
  } catch {}

  try {
    const rawPrView = activePort.gh(
      ['pr', 'view', cleanPr, '--json', 'headRefOid'],
      { cwd, env }
    );
    const prMeta = JSON.parse(rawPrView || '{}');
    const headSha = String(prMeta?.headRefOid || '').trim();
    if (headSha && /^[0-9a-f]{7,40}$/i.test(headSha)) {
      const rawRuns = activePort.gh(
        ['api', `repos/${cleanRepo}/commits/${headSha}/check-runs?per_page=50`],
        { cwd, env }
      );
      const checkRuns = JSON.parse(rawRuns || '{}')?.check_runs || [];
      const failedRuns = checkRuns.filter(
        (c) => c?.conclusion === 'failure' && !/Vercel/i.test(c?.name || '')
      );
      if (failedRuns.length > 0) {
        const lines = [
          '',
          '## 目前 PR 失敗的 CI Checks 與 CodeQL 註記（請一併修復）',
        ];
        for (const run of failedRuns) {
          lines.push('', `### ${run.name}`);
          if (run.output?.title) {
            lines.push(`- 摘要：${run.output.title}`);
          }
          try {
            const annRaw = activePort.gh(
              ['api', `repos/${cleanRepo}/check-runs/${run.id}/annotations`],
              { cwd, env }
            );
            const anns = JSON.parse(annRaw || '[]') || [];
            for (const a of anns
              .filter((x) => x?.path && x.path !== '.github')
              .slice(0, 15)) {
              const titlePrefix = a.title ? `${a.title}: ` : '';
              const msg = String(a.message || '')
                .replaceAll(CR, ' ')
                .replaceAll(LF, ' ')
                .trim()
                .slice(0, 400);
              const loc = `${BT}${a.path}:${a.start_line || 1}${BT}`;
              lines.push(
                `- ${loc} [${a.annotation_level}] ${titlePrefix}${msg}`
              );
            }
          } catch {}
        }
        sections.push(lines.join(LF));
      }
    }
  } catch {}

  return sections.join(LF);
}

function parseConcatenatedJsonArrays(rawText = '') {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) return [];
  try {
    const direct = JSON.parse(trimmed);
    return Array.isArray(direct) ? direct.flat() : [];
  } catch {
    const normalized = `[${trimmed.replace(/\]\s*\[/g, '],[')}]`;
    try {
      const pages = JSON.parse(normalized);
      return Array.isArray(pages) ? pages.flat() : [];
    } catch {
      return [];
    }
  }
}

export async function buildTicketBundle(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const env = options.env || process.env;
  const fsImpl = options.fsImpl || fs;
  const fetchImpl = options.fetchImpl || fetch;
  const port = options.port || createDefaultCommandPort({ repoRoot: cwd, env });

  const resolvedNum = extractTicketNumber(
    options.branchName || '',
    options.ticketNumber ?? env.TICKET_NUMBER ?? ''
  );
  if (!resolvedNum) {
    throw new Error('Ticket number is required to build ticket bundle.');
  }
  const ticketNumber = String(resolvedNum);

  const bundleOut = path.resolve(
    cwd,
    options.bundleOut || '.agents/tmp/ticket-bundle.json'
  );
  const specOut = path.resolve(
    cwd,
    options.specOut || '.agents/tmp/ticket-spec.md'
  );
  const imagesOutDir = path.resolve(
    cwd,
    options.imagesOutDir || '.agents/tmp/ticket-images'
  );
  const manifestOut = path.resolve(
    cwd,
    options.manifestOut || '.agents/tmp/visual-manifest.json'
  );

  const reuseCachedIssue = options.reuseCachedIssue !== false;
  const cached = reuseCachedIssue
    ? readCachedTicketBundle(bundleOut, resolvedNum, fsImpl)
    : null;

  const ghToken = resolveTrackerToken({
    explicitToken: options.ghToken,
    env,
    port,
    cwd,
  });

  const hasValidCachedIssue =
    cached?.ticketFound === true &&
    Boolean(cached.issue) &&
    Array.isArray(cached.htmlBlocks) &&
    Boolean(cached.cleanSpecMarkdown);

  let fullCtx = { ticketFound: hasValidCachedIssue };
  let issuePayload = hasValidCachedIssue ? cached.issue : null;
  let htmlBlocks = hasValidCachedIssue ? cached.htmlBlocks : null;
  let cleanSpecMarkdown = hasValidCachedIssue
    ? String(cached.cleanSpecMarkdown)
    : '';

  if (!hasValidCachedIssue) {
    if (ghToken) {
      try {
        fullCtx = await fetchFullTicketContext(
          options.branchName || '',
          ghToken,
          ticketNumber,
          { fetchImpl }
        );
      } catch {
        fullCtx = { ticketFound: false };
      }
    }

    if (fullCtx.ticketFound) {
      issuePayload = {
        number: fullCtx.number,
        title: fullCtx.title || '',
        state: fullCtx.state || 'OPEN',
        author: { login: fullCtx.author || '' },
        labels: Array.isArray(fullCtx.labels) ? fullCtx.labels : [],
        body: fullCtx.body || '',
        bodyHtml: fullCtx.bodyHtml || '',
        comments: Array.isArray(fullCtx.comments)
          ? fullCtx.comments.map((c) => ({
              author: { login: c.author || 'unknown' },
              createdAt: c.createdAt || '',
              body: c.body || '',
              bodyHtml: c.bodyHtml || '',
            }))
          : [],
      };
      htmlBlocks = Array.isArray(fullCtx.htmlBlocks)
        ? fullCtx.htmlBlocks
        : prioritizeIssueAndCommentBlocks(
            { body: fullCtx.body || '', body_html: fullCtx.bodyHtml || '' },
            issuePayload.comments.map((c) => ({
              body: c.body,
              body_html: c.bodyHtml,
            }))
          );
      cleanSpecMarkdown = formatIssueJsonToSpecMarkdown(issuePayload);
    } else if (!options.port && !options.fetchImpl) {
      const trackerRepo =
        options.trackerRepo || 'Xchange-Taiwan/X-Talent-Tracker';
      const fallbackMd = fetchIssueSpecViaGh({
        ticketNumber,
        repo: trackerRepo,
      });
      cleanSpecMarkdown = fallbackMd;
      issuePayload = {
        number: resolvedNum,
        title: '',
        state: 'OPEN',
        author: { login: '' },
        labels: [],
        body: fallbackMd,
        comments: [],
      };
      htmlBlocks = [{ body: fallbackMd, body_html: '', _fromComment: false }];
    } else {
      issuePayload = {
        number: resolvedNum,
        title: '',
        state: 'OPEN',
        author: { login: '' },
        labels: [],
        body: '',
        comments: [],
      };
      htmlBlocks = [];
      cleanSpecMarkdown = formatIssueJsonToSpecMarkdown(issuePayload);
    }
  }

  let archKb = hasValidCachedIssue && cached?.archKb ? cached.archKb : null;
  let archKbMarkdown = '';
  if (!options.skipKb) {
    if (!archKb) {
      const archQuery = [
        `#${resolvedNum}`,
        issuePayload?.title || '',
        String(issuePayload?.body || '').slice(0, 600),
      ]
        .filter(Boolean)
        .join(' ');
      archKb = await fetchRawArchitectureKb(archQuery, { fetchImpl });
    }
    archKbMarkdown = formatArchitectureKnowledgeBase(archKb);
  }

  const cachedVisualManifest = hasValidCachedIssue
    ? cached?.visualManifest
    : null;
  let visualManifest = cachedVisualManifest || {
    ticketNumber: resolvedNum,
    generatedAt: new Date().toISOString(),
    downloadedImages: [],
    capturedPrototypes: [],
    skippedProtectedUrls: [],
  };
  let visualManifestMarkdown = '';

  if (!options.skipVisuals) {
    visualManifest = await runPrefetchVisuals({
      ticketNumber,
      outDir: imagesOutDir,
      specFile: '',
      manifestFile: manifestOut,
      skipPrototypes: Boolean(options.skipPrototypes),
      ticketContext: { htmlBlocks },
      fetchImpl,
      fsImpl,
      ghToken,
    });
    visualManifestMarkdown = formatVisualManifestMarkdown(visualManifest);
  }

  let mergeConflictsMarkdown = '';
  if (options.mergeConflictsFile) {
    const conflictsPath = path.resolve(cwd, options.mergeConflictsFile);
    if (fsImpl.existsSync(conflictsPath)) {
      const rawConflicts = fsImpl.readFileSync(conflictsPath, 'utf8').trim();
      if (rawConflicts) {
        mergeConflictsMarkdown = `${LF}${LF}${rawConflicts}`;
      }
    }
  }

  const fixPrSupplementalMarkdown =
    options.prNumber && options.frontendRepo
      ? fetchFixPrSupplementalMarkdown({
          prNumber: options.prNumber,
          frontendRepo: options.frontendRepo,
          port,
          cwd,
          env,
        })
      : '';

  const specParts = [cleanSpecMarkdown.trimEnd()];
  if (archKbMarkdown) {
    specParts.push(archKbMarkdown);
  }
  if (mergeConflictsMarkdown) {
    specParts.push(mergeConflictsMarkdown);
  }
  if (fixPrSupplementalMarkdown) {
    specParts.push(`${LF}${fixPrSupplementalMarkdown}`);
  }
  if (visualManifestMarkdown) {
    specParts.push(`${LF}${visualManifestMarkdown}`);
  }
  const fullSpecMarkdown = `${specParts.join('')}${LF}`;

  const bundle = {
    version: 1,
    ticketNumber: resolvedNum,
    ticketFound: Boolean(fullCtx.ticketFound),
    generatedAt: new Date().toISOString(),
    issue: issuePayload,
    htmlBlocks,
    cleanSpecMarkdown,
    archKb,
    archKbMarkdown,
    visualManifest,
    visualManifestMarkdown,
  };

  fsImpl.mkdirSync(path.dirname(bundleOut), { recursive: true });
  fsImpl.writeFileSync(
    bundleOut,
    `${JSON.stringify(bundle, null, 2)}${LF}`,
    'utf8'
  );

  fsImpl.mkdirSync(path.dirname(specOut), { recursive: true });
  fsImpl.writeFileSync(specOut, fullSpecMarkdown, 'utf8');

  return {
    bundle,
    fullSpecMarkdown,
    bundleOut,
    specOut,
  };
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const parsed = parseTicketBundleArgs(process.argv.slice(2), process.env);
  buildTicketBundle(parsed)
    .then(({ bundle }) => {
      const imgCount = bundle.visualManifest?.downloadedImages?.length ?? 0;
      const protoCount = bundle.visualManifest?.capturedPrototypes?.length ?? 0;
      console.log(
        `[ticket-bundle] Ticket #${bundle.ticketNumber}: bundled ${bundle.issue?.comments?.length ?? 0} comment(s), ${imgCount} image(s), ${protoCount} prototype(s).`
      );
    })
    .catch((err) => {
      const safeMsg = redactCredentials(err?.message || String(err));
      console.error(`[ticket-bundle] Failed: ${safeMsg}`);
      process.exit(1);
    });
}
