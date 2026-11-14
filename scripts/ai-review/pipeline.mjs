import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { extractExistingEvidenceUrls } from '../generate-pr-description.mjs';
import {
  downloadVerifiedImage,
  extractTicketImageCandidates,
  sniffImageMimeType,
} from '../prefetch-ticket-visuals.mjs';
import { getDiff, getWorkingTreeDiff } from './lib/diff.mjs';
import {
  AI_REVIEW_COMMENT_MARKER,
  formatComment,
  resolveOverallRiskWithFailClosed,
} from './lib/format-comment.mjs';
import { callGemini } from './lib/gemini.mjs';
import { upsertComment } from './lib/pr-comment.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import {
  fetchFullTicketContext,
  fetchRawArchitectureKb,
  formatArchitectureKnowledgeBase,
  isUiReviewFile,
  resolveDesignSpecsFromKb,
} from './lib/ticket.mjs';
import {
  buildVisualContextMarkdown,
  loadReviewVisualAssets,
  MAX_EVIDENCE_BASE64_CHARS,
  MAX_EVIDENCE_IMAGES,
  MAX_REF_BASE64_CHARS,
  MAX_REF_IMAGES,
  selectWithinBase64Budget,
} from './lib/visuals.mjs';

export const DEFAULT_STAGE_CONCURRENCY = 4;
const MAX_SINGLE_IMAGE_BYTES = 5 * 1024 * 1024;
const NL = String.fromCharCode(10);

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

export async function runWithConcurrency(
  tasks,
  concurrency = DEFAULT_STAGE_CONCURRENCY
) {
  const limit = Math.max(
    1,
    Math.floor(Number(concurrency) || DEFAULT_STAGE_CONCURRENCY)
  );
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex;
      nextIndex += 1;
      results[idx] = await tasks[idx]();
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function normalizeVisualAssets(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const refImages = Array.isArray(safe.refImages) ? safe.refImages : [];
  const evidenceImages = Array.isArray(safe.evidenceImages)
    ? safe.evidenceImages
    : [];
  const images = Array.isArray(safe.images)
    ? safe.images
    : [...refImages, ...evidenceImages];
  const domSummariesMd =
    typeof safe.domSummariesMd === 'string' ? safe.domSummariesMd : '';

  const generated = buildVisualContextMarkdown({
    refImages,
    evidenceImages,
    domSummariesMd,
  });

  return {
    images,
    refImages,
    evidenceImages,
    refCount: refImages.length,
    evidenceCount: evidenceImages.length,
    visualContextMarkdown:
      typeof safe.visualContextMarkdown === 'string'
        ? safe.visualContextMarkdown
        : generated.visualContextMarkdown,
    evidenceContextMarkdown:
      typeof safe.evidenceContextMarkdown === 'string'
        ? safe.evidenceContextMarkdown
        : generated.evidenceContextMarkdown,
  };
}

function extractDiffTouchedFiles(diffText = '') {
  const files = [];
  for (const line of String(diffText).split(NL)) {
    if (!line.startsWith('diff --git a/')) continue;
    const match = line.match(/^diff --git a\/.+? b\/(.+?)$/);
    if (match?.[1]) {
      files.push(match[1]);
    }
  }
  return files;
}

function invokeLlmPort(llmPort, prompt, { stage, images = [] }) {
  if (typeof llmPort === 'function') {
    return llmPort(prompt, { stage, images });
  }
  if (typeof llmPort?.generateJson === 'function') {
    return llmPort.generateJson(prompt, { stage, images });
  }
  if (typeof llmPort?.callGemini === 'function') {
    return llmPort.callGemini(prompt, { stage, images });
  }
  throw new Error('Invalid llmPort: expected generateJson(prompt, options)');
}

export function createGeminiLlmPort({
  apiKey,
  callGeminiImpl = callGemini,
} = {}) {
  return {
    isAvailable() {
      return Boolean(apiKey ?? process.env.GEMINI_API_KEY);
    },
    generateJson(prompt, { images = [] } = {}) {
      return callGeminiImpl(prompt, { images });
    },
  };
}

function resolveLocalGithubToken() {
  const envToken =
    process.env.TRACKER_READ_TOKEN || process.env.GITHUB_TOKEN || '';
  if (envToken) return envToken;
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function createLocalContextPort({
  ticketImagesDir,
  evidenceDir,
  fetchImpl = fetch,
} = {}) {
  return {
    resolveBranch() {
      return execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim();
    },
    getDiff({ baseRef }) {
      return getWorkingTreeDiff(baseRef);
    },
    async loadIssueContext({ branch, ticketNumber }) {
      const ghToken = resolveLocalGithubToken();
      if (!ghToken) {
        return { ticketFound: false };
      }
      return fetchFullTicketContext(branch, ghToken, ticketNumber, {
        fetchImpl,
      });
    },
    loadArchitectureKb(query) {
      return fetchRawArchitectureKb(query);
    },
    loadVisualAssets() {
      return loadReviewVisualAssets({ ticketImagesDir, evidenceDir });
    },
  };
}

function readPrBodyFromEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return '';
  try {
    const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    return String(payload?.pull_request?.body ?? '');
  } catch {
    return '';
  }
}

async function fetchPrBody({ repo, prNumber, githubToken, fetchImpl = fetch }) {
  if (repo && prNumber && githubToken) {
    try {
      const res = await fetchImpl(
        `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        return String(data?.body ?? '');
      }
    } catch {
      // Fall back to event payload below
    }
  }
  return readPrBodyFromEventPayload();
}

async function downloadCiReferenceImages(
  htmlBlocks = [],
  trackerToken = '',
  fetchImpl = fetch
) {
  if (!Array.isArray(htmlBlocks) || htmlBlocks.length === 0) return [];
  const candidates = extractTicketImageCandidates(htmlBlocks).slice(
    0,
    MAX_REF_IMAGES
  );
  const rawRefs = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const dl = await downloadVerifiedImage(
        candidate.url,
        trackerToken,
        fetchImpl
      );
      if (!dl || dl.buffer.length > MAX_SINGLE_IMAGE_BYTES) continue;
      rawRefs.push({
        mimeType: dl.mimeType,
        base64Data: dl.buffer.toString('base64'),
        label: `Ticket/DesignHub 設計參考圖: #${i + 1}${candidate.alt ? ` (${candidate.alt})` : ''}`,
      });
    } catch {
      // Ignore unreachable attachment
    }
  }
  return selectWithinBase64Budget(rawRefs, MAX_REF_BASE64_CHARS);
}

async function downloadCiPrEvidenceImages({
  repo,
  prNumber,
  githubToken,
  fetchImpl = fetch,
}) {
  if (!prNumber) return [];
  const prBody = await fetchPrBody({
    repo,
    prNumber,
    githubToken,
    fetchImpl,
  });
  const urls = extractExistingEvidenceUrls(prBody).slice(
    0,
    MAX_EVIDENCE_IMAGES
  );
  const rawEvidence = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const dl = await downloadVerifiedImage(url, githubToken, fetchImpl);
      if (!dl || dl.buffer.length > MAX_SINGLE_IMAGE_BYTES) continue;
      const sniffed = sniffImageMimeType(dl.buffer);
      if (!sniffed) continue;
      const fileName = decodeURIComponent(
        new URL(url).pathname.split('/').pop() || `pr-shot-${i + 1}.png`
      );
      rawEvidence.push({
        mimeType: sniffed.mimeType,
        base64Data: dl.buffer.toString('base64'),
        label: `實作後 Playwright 實際截圖證據: ${fileName}`,
      });
    } catch {
      // Skip failed image download
    }
  }

  return selectWithinBase64Budget(rawEvidence, MAX_EVIDENCE_BASE64_CHARS);
}

export function createCiContextPort({
  trackerToken = process.env.TRACKER_READ_TOKEN || '',
  githubToken = process.env.GITHUB_TOKEN || '',
  repo = process.env.GITHUB_REPOSITORY || '',
  fetchImpl = fetch,
  writeCommentFile = true,
} = {}) {
  return {
    getDiff({ baseRef, headSha }) {
      return getDiff(baseRef, headSha);
    },
    async loadIssueContext({ branch, ticketNumber }) {
      if (!trackerToken) {
        console.warn(
          '[ai-review-ci] TRACKER_READ_TOKEN not set, skipping ticket lookup'
        );
        return { ticketFound: false };
      }
      return fetchFullTicketContext(branch, trackerToken, ticketNumber, {
        fetchImpl,
      });
    },
    loadArchitectureKb(query) {
      return fetchRawArchitectureKb(query);
    },
    async loadVisualAssets({ ticket, prNumber }) {
      const [refImages, evidenceImages] = await Promise.all([
        downloadCiReferenceImages(
          ticket?.htmlBlocks || [],
          trackerToken,
          fetchImpl
        ),
        downloadCiPrEvidenceImages({
          repo,
          prNumber,
          githubToken: githubToken || trackerToken,
          fetchImpl,
        }),
      ]);
      const { visualContextMarkdown, evidenceContextMarkdown } =
        buildVisualContextMarkdown({
          refImages,
          evidenceImages,
        });
      return {
        images: [...refImages, ...evidenceImages],
        refImages,
        evidenceImages,
        refCount: refImages.length,
        evidenceCount: evidenceImages.length,
        visualContextMarkdown,
        evidenceContextMarkdown,
      };
    },
    async postPrComment({ comment, prNumber, repo: overrideRepo }) {
      const targetRepo = overrideRepo || repo;
      if (writeCommentFile) {
        fs.writeFileSync('ai-review-comment.md', comment, 'utf-8');
      }
      if (!githubToken || !targetRepo || !prNumber) {
        throw new Error(
          'GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required to post PR comment'
        );
      }
      await upsertComment({
        repo: targetRepo,
        issueNumber: prNumber,
        token: githubToken,
        marker: AI_REVIEW_COMMENT_MARKER,
        body: comment,
      });
    },
  };
}

function emptyFindingsRecord() {
  return {
    security: [],
    correctness: [],
    businessLogic: [],
    visualParity: [],
    performance: [],
    testing: [],
    architecture: [],
  };
}

/**
 * Unified multimodal AI review pipeline shared by `run-local.mjs` and `run-ci.mjs`.
 *
 * Orchestrates single-flight issue + paginated comments loading via `contextPort`,
 * forwards design reference and Playwright evidence images consistently across
 * `planner`, `business-logic`, `testing`, and `visual-parity`, and executes
 * reviewer stages with bounded concurrency.
 */
export async function runAiReviewPipeline(
  input = {},
  { llmPort, contextPort } = {}
) {
  const mode = input.mode === 'ci' ? 'ci' : 'local';
  const baseRef = input.baseRef || process.env.BASE_REF || 'origin/develop';
  const headSha = input.headSha || process.env.HEAD_SHA || '';
  const explicitTicket = input.ticketNumber || process.env.TICKET_NUMBER || '';
  const prNumber = input.prNumber || process.env.PR_NUMBER || '';
  const repo = input.repo || process.env.GITHUB_REPOSITORY || '';
  const e2eReport =
    input.e2eReport ?? process.env.E2E_VERIFICATION_REPORT ?? '';
  const strict =
    input.strict ??
    (mode === 'ci' ? true : process.env.STRICT_AI_REVIEW !== '0');
  const concurrency =
    Number(input.concurrency || process.env.AI_REVIEW_CONCURRENCY) ||
    DEFAULT_STAGE_CONCURRENCY;
  const includeReviewGuide = input.includeReviewGuide ?? mode === 'ci';
  const allowStageFallback = input.allowStageFallback ?? mode === 'ci';
  const shouldPostComment = input.postComment ?? mode === 'ci';

  const activeLlmPort = llmPort || createGeminiLlmPort();
  const activeContextPort =
    contextPort ||
    (mode === 'ci' ? createCiContextPort({ repo }) : createLocalContextPort());

  const llmAvailable =
    typeof activeLlmPort?.isAvailable === 'function'
      ? Boolean(activeLlmPort.isAvailable())
      : true;

  if (!llmAvailable) {
    if (!strict) {
      return {
        mode: 'fallback-in-context',
        exitCode: 0,
        overallRisk: {
          level: 'low',
          reason:
            'No local GEMINI_API_KEY found under STRICT_AI_REVIEW=0. Rely on local lint/type-check/vitest and GitHub Actions CI Gemini review.',
        },
        requirementCoverage: [],
        findings: {},
      };
    }
    if (mode === 'ci') {
      throw new Error('GEMINI_API_KEY is missing (fail-closed).');
    }
    return {
      mode: 'review-error',
      reviewError: true,
      exitCode: 1,
      overallRisk: {
        level: 'high',
        reason: 'GEMINI_API_KEY is missing (fail-closed).',
      },
      requirementCoverage: [],
      findings: {},
    };
  }

  try {
    const branch =
      input.branch ||
      (typeof activeContextPort.resolveBranch === 'function'
        ? await activeContextPort.resolveBranch({ baseRef, headSha })
        : process.env.HEAD_REF || '');

    const diffPayload =
      typeof activeContextPort.getDiff === 'function'
        ? await activeContextPort.getDiff({ baseRef, headSha, branch })
        : { diff: '', truncated: false };
    const safeDiff = String(diffPayload?.diff ?? '');
    const truncated = Boolean(diffPayload?.truncated);

    if (!safeDiff.trim()) {
      const cleanStage = {
        hasFindings: false,
        summary: '無程式碼差異需審查',
        findings: [],
      };
      const emptySummary = {
        requirementCoverage: [],
        overallRisk: {
          level: 'low',
          reason: `Empty diff against ${baseRef}.`,
        },
        mergeRecommendation: '可合併',
      };
      let comment = '';
      if (mode === 'ci' || input.formatPrComment) {
        comment = formatComment({
          plan: {
            ticketFound: false,
            ticketNumber: null,
            requirementSummary: `Empty diff against ${baseRef}.`,
            acceptanceCriteria: [],
            outOfRepoCriteria: [],
            filesTouched: [],
            riskAreas: [],
          },
          reviewGuide: includeReviewGuide
            ? {
                overview: '本次變更無審查範圍內之程式碼差異。',
                readingOrder: [],
              }
            : undefined,
          security: cleanStage,
          correctness: cleanStage,
          businessLogic: cleanStage,
          visualParity: cleanStage,
          performance: cleanStage,
          testing: cleanStage,
          architecture: cleanStage,
          summary: emptySummary,
          headSha,
        });
        if (
          shouldPostComment &&
          typeof activeContextPort.postPrComment === 'function'
        ) {
          await activeContextPort.postPrComment({
            comment,
            headSha,
            prNumber,
            repo,
          });
        }
      }
      return {
        mode: mode === 'ci' ? 'gemini-ci' : 'gemini-local',
        emptyDiff: true,
        exitCode: 0,
        overallRisk: emptySummary.overallRisk,
        mergeRecommendation: emptySummary.mergeRecommendation,
        requirementCoverage: [],
        findings: emptyFindingsRecord(),
        comment,
      };
    }

    // Single-flight memoized issue + paginated comments loader
    const issueLoader =
      activeContextPort.loadIssueContext ||
      activeContextPort.fetchIssueContext ||
      activeContextPort.fetchTicketContext;
    let issuePromise = null;
    const getIssueOnce = () => {
      if (!issuePromise) {
        issuePromise =
          typeof issueLoader === 'function'
            ? Promise.resolve(
                issueLoader.call(activeContextPort, {
                  branch,
                  ticketNumber: explicitTicket,
                })
              ).catch((err) => {
                console.warn(
                  `[ai-review] failed to load ticket context, falling back to diff-only: ${err.message}`
                );
                return { ticketFound: false };
              })
            : Promise.resolve({ ticketFound: false });
      }
      return issuePromise;
    };

    const ticket = (await getIssueOnce()) || { ticketFound: false };
    const kbQuery = ticket.ticketFound
      ? `#${ticket.number} ${ticket.title || ''} ${branch}`.trim()
      : branch;

    let archKbPromise = null;
    const getArchKbOnce = () => {
      if (!archKbPromise) {
        archKbPromise =
          typeof activeContextPort.loadArchitectureKb === 'function'
            ? Promise.resolve(
                activeContextPort.loadArchitectureKb(kbQuery, {
                  ticket,
                  branch,
                })
              ).catch(() => null)
            : Promise.resolve(null);
      }
      return archKbPromise;
    };

    let visualsPromise = null;
    const getVisualsOnce = () => {
      if (!visualsPromise) {
        visualsPromise =
          typeof activeContextPort.loadVisualAssets === 'function'
            ? Promise.resolve(
                activeContextPort.loadVisualAssets({
                  ticket,
                  branch,
                  prNumber,
                })
              ).catch(() => ({}))
            : Promise.resolve({});
      }
      return visualsPromise;
    };

    const [rawKb, rawVisuals] = await Promise.all([
      getArchKbOnce(),
      getVisualsOnce(),
    ]);

    const visualAssets = normalizeVisualAssets(rawVisuals);
    const archKbSection = formatArchitectureKnowledgeBase(rawKb);
    const designSpecsObj = resolveDesignSpecsFromKb(rawKb);
    const designSpecsMarkdown = designSpecsObj
      ? [
          '```json',
          JSON.stringify(designSpecsObj, null, 2).slice(0, 9500),
          '```',
        ].join(NL)
      : '（Cloudflare KV 無對應此票號之 Design Hub 記錄，請依據 Ticket 設計參考圖與規格審查）';

    const e2eSection = e2eReport
      ? [NL + '## 雲端 Playwright E2E 驗證狀態', e2eReport].join(NL)
      : '';
    const visualNote = visualAssets.visualContextMarkdown || '';
    const commentsList = Array.isArray(ticket.comments) ? ticket.comments : [];
    const commentsText =
      commentsList.length > 0
        ? [
            '',
            '',
            '### Comments',
            ...commentsList.map((c) => `- ${c.author}: ${c.body}`),
          ].join(NL)
        : ticket.ticketFound
          ? [NL + '### Comments', '(無留言)'].join(NL)
          : '';

    const ticketSection = ticket.ticketFound
      ? [
          '## 對應 Ticket',
          `**#${ticket.number} ${ticket.title}**`,
          '',
          `${ticket.body ?? ''}${commentsText}${visualNote}${e2eSection}${archKbSection}`,
        ].join(NL)
      : `## 對應 Ticket${NL}（僅根據 diff 進行分析）${visualNote}${e2eSection}${archKbSection}`;

    const truncatedNote = truncated ? '（注意：diff 過大，內容已截斷）' : '';
    const planPrompt = buildPrompt(
      new URL('./prompts/planner.md', import.meta.url),
      {
        TICKET_SECTION: ticketSection,
        DIFF: safeDiff,
        TRUNCATED_NOTE: truncatedNote,
      }
    );

    let plan;
    try {
      plan = await invokeLlmPort(activeLlmPort, planPrompt, {
        stage: 'planner',
        images: visualAssets.images,
      });
    } catch (err) {
      if (!allowStageFallback) {
        throw err;
      }
      console.error(
        `[planner] failed, degrading downstream stages: ${err.message}`
      );
      const degradedCore = {
        hasFindings: false,
        skippedDueToError: true,
        summary: `上游 Planner 階段失敗（${err.message}）`,
        findings: [],
      };
      const degradedGuide = includeReviewGuide
        ? {
            skippedDueToError: true,
            summary: `上游 Planner 階段失敗（${err.message}）`,
          }
        : undefined;
      const degradedRisk = resolveOverallRiskWithFailClosed({
        summary: undefined,
        security: degradedCore,
        correctness: degradedCore,
        businessLogic: degradedCore,
        visualParity: degradedCore,
        performance: degradedCore,
        testing: degradedCore,
        architecture: degradedCore,
      }) || {
        level: 'medium',
        reason: `Planner failed: ${err.message}`,
      };
      const comment =
        mode === 'ci' || input.formatPrComment
          ? formatComment({
              plan: undefined,
              reviewGuide: degradedGuide,
              security: degradedCore,
              correctness: degradedCore,
              businessLogic: degradedCore,
              visualParity: degradedCore,
              performance: degradedCore,
              testing: degradedCore,
              architecture: degradedCore,
              summary: undefined,
              headSha,
            })
          : '';
      if (
        comment &&
        shouldPostComment &&
        typeof activeContextPort.postPrComment === 'function'
      ) {
        await activeContextPort.postPrComment({
          comment,
          headSha,
          prNumber,
          repo,
        });
      }
      return {
        mode: mode === 'ci' ? 'gemini-ci' : 'gemini-local',
        exitCode: 0,
        plan: undefined,
        reviewGuide: degradedGuide,
        stages: {
          security: degradedCore,
          correctness: degradedCore,
          businessLogic: degradedCore,
          visualParity: degradedCore,
          performance: degradedCore,
          testing: degradedCore,
          architecture: degradedCore,
        },
        summary: undefined,
        overallRisk: degradedRisk,
        mergeRecommendation: '',
        requirementCoverage: [],
        findings: emptyFindingsRecord(),
        comment,
      };
    }

    const planJson = JSON.stringify(plan, null, 2);
    const touchedFiles =
      Array.isArray(plan?.filesTouched) && plan.filesTouched.length > 0
        ? plan.filesTouched
        : extractDiffTouchedFiles(safeDiff);
    const hasUiChanges = touchedFiles.some(isUiReviewFile);

    const runPromptStage = async ({
      stage,
      promptFile,
      images = [],
      visualContext = '',
      extraVars = {},
      isGuide = false,
    }) => {
      const hasImages = Array.isArray(images) && images.length > 0;
      const prompt = buildPrompt(
        new URL(`./prompts/${promptFile}`, import.meta.url),
        {
          PLAN_JSON: planJson,
          DIFF: safeDiff,
          TRUNCATED_NOTE: truncatedNote,
          VISUAL_CONTEXT: hasImages ? visualContext : '',
          ...extraVars,
        }
      );
      try {
        return await invokeLlmPort(activeLlmPort, prompt, {
          stage,
          images: hasImages ? images : [],
        });
      } catch (err) {
        if (!allowStageFallback) {
          throw err;
        }
        console.warn(
          `[${stage}] Non-fatal stage error (${err.message}); emitting skippedDueToError fallback.`
        );
        if (isGuide) {
          return {
            skippedDueToError: true,
            summary: `導讀產生因暫時性錯誤略過（${err.message}）`,
          };
        }
        return {
          hasFindings: false,
          skippedDueToError: true,
          summary: `此領域審查因暫時性錯誤略過（${err.message}）`,
          findings: [],
        };
      }
    };

    const visualSkipCheck = shouldSkipVisualParity({
      hasUiChanges,
      refImagesCount: visualAssets.refImages.length,
      prImagesCount: visualAssets.evidenceImages.length,
      designSpecsObj,
    });

    const stageTasks = [
      () =>
        runPromptStage({
          stage: 'security',
          promptFile: 'security.md',
        }),
      () =>
        runPromptStage({
          stage: 'correctness',
          promptFile: 'correctness.md',
        }),
      () =>
        runPromptStage({
          stage: 'business-logic',
          promptFile: 'business-logic.md',
          images: visualAssets.images,
          visualContext: visualNote,
        }),
      () => {
        if (visualSkipCheck.skip) {
          return Promise.resolve({
            hasFindings: false,
            summary: visualSkipCheck.summary,
            findings: [],
          });
        }
        const prompt = buildPrompt(
          new URL('./prompts/visual-parity.md', import.meta.url),
          {
            PLAN_JSON: planJson,
            DESIGN_HUB_SPECS: designSpecsMarkdown,
            VISUAL_CONTEXT: visualNote,
            DIFF: safeDiff,
            TRUNCATED_NOTE: truncatedNote,
          }
        );
        return Promise.resolve()
          .then(() =>
            invokeLlmPort(activeLlmPort, prompt, {
              stage: 'visual-parity',
              images: visualAssets.images,
            })
          )
          .catch((err) => {
            if (!allowStageFallback) {
              throw err;
            }
            console.warn(
              `[visual-parity] Non-fatal stage error (${err.message}); emitting skippedDueToError fallback.`
            );
            return {
              hasFindings: false,
              skippedDueToError: true,
              summary: `視覺審查因暫時性錯誤略過（${err.message}）`,
              findings: [],
            };
          });
      },
      () =>
        runPromptStage({
          stage: 'performance',
          promptFile: 'performance.md',
        }),
      () =>
        runPromptStage({
          stage: 'testing',
          promptFile: 'testing.md',
          images: visualAssets.evidenceImages,
          visualContext: visualAssets.evidenceContextMarkdown || '',
        }),
      () =>
        runPromptStage({
          stage: 'architecture',
          promptFile: 'architecture.md',
        }),
      ...(includeReviewGuide
        ? [
            () =>
              runPromptStage({
                stage: 'review-guide',
                promptFile: 'review-guide.md',
                isGuide: true,
              }),
          ]
        : []),
    ];

    const stageResults = await runWithConcurrency(stageTasks, concurrency);
    const [
      security,
      correctness,
      businessLogic,
      visualParity,
      performance,
      testing,
      architecture,
      reviewGuide,
    ] = stageResults;

    const summaryPrompt = buildPrompt(
      new URL('./prompts/summary.md', import.meta.url),
      {
        PLAN_JSON: planJson,
        SECURITY_FINDINGS_JSON: JSON.stringify(security ?? null, null, 2),
        CORRECTNESS_FINDINGS_JSON: JSON.stringify(correctness ?? null, null, 2),
        BUSINESS_LOGIC_FINDINGS_JSON: JSON.stringify(
          businessLogic ?? null,
          null,
          2
        ),
        VISUAL_PARITY_FINDINGS_JSON: JSON.stringify(
          visualParity ?? null,
          null,
          2
        ),
        PERFORMANCE_FINDINGS_JSON: JSON.stringify(performance ?? null, null, 2),
        TESTING_FINDINGS_JSON: JSON.stringify(testing ?? null, null, 2),
        ARCHITECTURE_FINDINGS_JSON: JSON.stringify(
          architecture ?? null,
          null,
          2
        ),
      }
    );

    let summary;
    try {
      summary = await invokeLlmPort(activeLlmPort, summaryPrompt, {
        stage: 'summary',
        images: [],
      });
    } catch (err) {
      if (!allowStageFallback) {
        throw err;
      }
      console.error(
        `[summary] final-judgment call failed, posting without it: ${err.message}`
      );
      summary = undefined;
    }

    const effectiveRisk = resolveOverallRiskWithFailClosed({
      summary,
      security,
      correctness,
      businessLogic,
      visualParity,
      performance,
      testing,
      architecture,
    }) ||
      summary?.overallRisk || {
        level: 'low',
        reason: 'Completed',
      };

    let comment = '';
    if (mode === 'ci' || input.formatPrComment) {
      comment = formatComment({
        plan,
        reviewGuide,
        security,
        correctness,
        businessLogic,
        visualParity,
        performance,
        testing,
        architecture,
        summary,
        headSha,
      });
      if (
        shouldPostComment &&
        typeof activeContextPort.postPrComment === 'function'
      ) {
        await activeContextPort.postPrComment({
          comment,
          headSha,
          prNumber,
          repo,
        });
      }
    }

    return {
      mode: mode === 'ci' ? 'gemini-ci' : 'gemini-local',
      exitCode: 0,
      plan,
      reviewGuide,
      stages: {
        security,
        correctness,
        businessLogic,
        visualParity,
        performance,
        testing,
        architecture,
      },
      summary,
      overallRisk: effectiveRisk,
      mergeRecommendation: summary?.mergeRecommendation ?? '',
      requirementCoverage: Array.isArray(summary?.requirementCoverage)
        ? summary.requirementCoverage
        : [],
      findings: {
        security: security?.findings ?? [],
        correctness: correctness?.findings ?? [],
        businessLogic: businessLogic?.findings ?? [],
        visualParity: visualParity?.findings ?? [],
        performance: performance?.findings ?? [],
        testing: testing?.findings ?? [],
        architecture: architecture?.findings ?? [],
      },
      comment,
    };
  } catch (err) {
    if (mode === 'ci') {
      throw err;
    }
    if (!strict) {
      console.warn(
        `[ai-review-local] Gemini call skipped (${err.message}); falling back to CI review (STRICT_AI_REVIEW=0).`
      );
      return {
        mode: 'fallback-ci',
        exitCode: 0,
        overallRisk: {
          level: 'low',
          reason: 'Deferred to GitHub Actions CI Gemini pipeline.',
        },
        requirementCoverage: [],
        findings: {},
      };
    }
    console.error(
      `[ai-review-local] Review failed (fail-closed): ${err.message}`
    );
    return {
      mode: 'review-error',
      reviewError: true,
      exitCode: 1,
      overallRisk: {
        level: 'high',
        reason: `AI Review execution failed: ${err.message}`,
      },
      requirementCoverage: [],
      findings: {},
    };
  }
}
