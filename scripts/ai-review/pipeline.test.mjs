// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  evaluateFinalPrConvergence,
  evaluatePollProgress,
} from '../../.agents/scripts/wait-pr-checks.mjs';
import {
  createCiContextPort,
  runAiReviewPipeline,
  runWithConcurrency,
} from './pipeline.mjs';
import { formatLocalCliOutput } from './run-local.mjs';

const NL = String.fromCharCode(10);
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function buildDefaultStageMockResponse(stage) {
  if (stage === 'planner') {
    return {
      ticketFound: true,
      ticketNumber: 882,
      requirementSummary: 'Unify multimodal AI review pipeline',
      acceptanceCriteria: ['Single multimodal pipeline module'],
      outOfRepoCriteria: [],
      filesTouched: ['src/components/profile/MentorTabs.tsx'],
      riskAreas: ['UI alignment'],
      notesForReviewers: 'Verify multimodal attachments',
    };
  }
  if (stage === 'review-guide') {
    return {
      overview: 'Unified local and CI AI review pipeline.',
      readingOrder: [
        {
          file: 'src/components/profile/MentorTabs.tsx',
          order: 1,
          why: 'Core UI tab layout',
        },
      ],
    };
  }
  if (stage === 'summary') {
    return {
      requirementCoverage: [
        {
          criterion: 'Single multimodal pipeline module',
          scope: 'frontend',
          covered: true,
          note: 'Implemented in pipeline.mjs',
        },
      ],
      overallRisk: {
        level: 'low',
        reason: 'All checks clean and aligned with design specs.',
      },
      mergeRecommendation: '可合併',
    };
  }
  return {
    hasFindings: false,
    summary: `${stage} clean`,
    findings: [],
  };
}

describe('scripts/ai-review/pipeline.mjs', () => {
  it('forwards design reference and Playwright evidence images consistently across planner, business-logic, testing, and visual-parity in both local and CI modes', async () => {
    const refImg1 = {
      mimeType: 'image/png',
      base64Data: TINY_PNG.toString('base64'),
      label: 'Ticket/DesignHub 設計參考圖: design-01.png',
    };
    const refImg2 = {
      mimeType: 'image/png',
      base64Data: TINY_PNG.toString('base64'),
      label: 'Ticket/DesignHub 設計參考圖: design-02.png',
    };
    const evidenceImg = {
      mimeType: 'image/png',
      base64Data: TINY_PNG.toString('base64'),
      label: '實作後 Playwright 實際截圖證據: mentor-tabs-open.png',
    };

    for (const mode of ['local', 'ci']) {
      const stageCalls = new Map();
      const llmPort = {
        isAvailable: () => true,
        generateJson: vi.fn(async (prompt, { stage, images }) => {
          stageCalls.set(stage, { prompt, images });
          return buildDefaultStageMockResponse(stage);
        }),
      };

      const postPrComment = vi.fn(async () => {});
      const contextPort = {
        resolveBranch: () => 'refactor/882-unify-ai-review',
        getDiff: () => ({
          diff: [
            'diff --git a/src/components/profile/MentorTabs.tsx b/src/components/profile/MentorTabs.tsx',
            '--- a/src/components/profile/MentorTabs.tsx',
            '+++ b/src/components/profile/MentorTabs.tsx',
            '@@ -1,2 +1,2 @@',
            '-export const TAB = 1;',
            '+export const TAB = 2;',
          ].join(NL),
          truncated: false,
        }),
        loadIssueContext: vi.fn(async () => ({
          ticketFound: true,
          number: 882,
          title: 'Collapse shallow AI review wrappers',
          body: 'Detailed specification body',
          comments: [{ author: 'LowSugarCoke', body: 'Ready with Minor Notes' }],
        })),
        loadArchitectureKb: vi.fn(async () => ({
          matchedDesignSpecs: {
            screens: [{ id: 'mentor-profile', rules: ['4-column summary'] }],
          },
        })),
        loadVisualAssets: vi.fn(async () => ({
          refImages: [refImg1, refImg2],
          evidenceImages: [evidenceImg],
        })),
        postPrComment,
      };

      const res = await runAiReviewPipeline(
        {
          mode,
          headSha: 'abcdef1234567890',
          prNumber: '999',
          repo: 'Xchange-Taiwan/X-Talent-Frontend',
        },
        { llmPort, contextPort }
      );

      expect(res.exitCode).toBe(0);
      expect(res.overallRisk.level).toBe('low');

      // 4 multimodal stages receive exact expected image sets:
      expect(stageCalls.get('planner')?.images).toEqual([
        refImg1,
        refImg2,
        evidenceImg,
      ]);
      expect(stageCalls.get('planner')?.prompt).toContain(
        '多模態視覺審查附件說明'
      );
      expect(stageCalls.get('planner')?.prompt).toContain(
        'Ready with Minor Notes'
      );

      expect(stageCalls.get('business-logic')?.images).toEqual([
        refImg1,
        refImg2,
        evidenceImg,
      ]);
      expect(stageCalls.get('business-logic')?.prompt).toContain(
        'Ticket/DesignHub 設計參考圖'
      );

      expect(stageCalls.get('testing')?.images).toEqual([evidenceImg]);
      expect(stageCalls.get('testing')?.prompt).toContain(
        '實作後 Playwright 實際截圖證據'
      );
      expect(stageCalls.get('testing')?.prompt).not.toContain(
        'Ticket/DesignHub 設計參考圖'
      );

      expect(stageCalls.get('visual-parity')?.images).toEqual([
        refImg1,
        refImg2,
        evidenceImg,
      ]);
      expect(stageCalls.get('visual-parity')?.prompt).toContain(
        '4-column summary'
      );

      // Text-only stages receive empty image arrays:
      expect(stageCalls.get('security')?.images).toEqual([]);
      expect(stageCalls.get('correctness')?.images).toEqual([]);
      expect(stageCalls.get('performance')?.images).toEqual([]);
      expect(stageCalls.get('architecture')?.images).toEqual([]);
      expect(stageCalls.get('summary')?.images).toEqual([]);

      if (mode === 'ci') {
        expect(stageCalls.get('review-guide')?.images).toEqual([]);
        expect(postPrComment).toHaveBeenCalledTimes(1);
      } else {
        expect(stageCalls.has('review-guide')).toBe(false);
        expect(postPrComment).not.toHaveBeenCalled();
      }
    }
  });

  it('loads GitHub issue + paginated comments in a single flight and reuses htmlBlocks without re-fetching the issue', async () => {
    const issueUrl =
      'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Tracker/issues/882';
    const commentsPage1Url =
      'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Tracker/issues/882/comments?per_page=100';
    const commentsPage2Url =
      'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Tracker/issues/882/comments?per_page=100&page=2';
    const prUrl =
      'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Frontend/pulls/456';
    const refImgUrl =
      'https://private-user-images.githubusercontent.com/123/11111111-2222-3333-4444-555555555555.png?jwt=signed';
    const prEvidenceUrl =
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/pr-evidence/882/desktop-open.png';

    const requestedUrls = [];
    const fetchMock = vi.fn(async (rawUrl) => {
      const url = String(rawUrl);
      requestedUrls.push(url);

      if (url === issueUrl) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            number: 882,
            title: 'Unified Multimodal Review',
            body: 'Issue body text',
            body_html: `<p><img src="${refImgUrl}" alt="Design Spec" /></p>`,
          }),
        };
      }
      if (url === commentsPage1Url) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h) =>
              h.toLowerCase() === 'link'
                ? `<${commentsPage2Url}>; rel="next"`
                : null,
          },
          json: async () => [
            {
              user: { login: 'alice' },
              body: 'First page comment',
              body_html: '<p>First page comment</p>',
            },
          ],
        };
      }
      if (url === commentsPage2Url) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => [
            {
              user: { login: 'bob' },
              body: 'Second page comment',
              body_html: '<p>Second page comment</p>',
            },
          ],
        };
      }
      if (url === prUrl) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            body: ['## Screenshot', `![desktop](${prEvidenceUrl})`].join(NL),
          }),
        };
      }
      if (url === refImgUrl || url === prEvidenceUrl) {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => null },
          arrayBuffer: async () =>
            TINY_PNG.buffer.slice(
              TINY_PNG.byteOffset,
              TINY_PNG.byteOffset + TINY_PNG.byteLength
            ),
        };
      }
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: async () => ({}),
      };
    });

    const baseCiPort = createCiContextPort({
      trackerToken: 'tracker-secret',
      githubToken: 'gh-secret',
      repo: 'Xchange-Taiwan/X-Talent-Frontend',
      fetchImpl: fetchMock,
      writeCommentFile: false,
    });

    const loadIssueSpy = vi.spyOn(baseCiPort, 'loadIssueContext');
    const postedComments = [];
    const contextPort = {
      ...baseCiPort,
      getDiff: () => ({
        diff: [
          'diff --git a/src/app/mentor-pool/page.tsx b/src/app/mentor-pool/page.tsx',
          '+++ b/src/app/mentor-pool/page.tsx',
          '+export default function Page() { return <main />; }',
        ].join(NL),
        truncated: false,
      }),
      loadArchitectureKb: async () => null,
      postPrComment: async (payload) => {
        postedComments.push(payload);
      },
    };

    const stagePrompts = {};
    const stageImages = {};
    const llmPort = {
      isAvailable: () => true,
      generateJson: vi.fn(async (prompt, { stage, images }) => {
        stagePrompts[stage] = prompt;
        stageImages[stage] = images;
        if (stage === 'planner') {
          return {
            ...buildDefaultStageMockResponse('planner'),
            filesTouched: ['src/app/mentor-pool/page.tsx'],
          };
        }
        return buildDefaultStageMockResponse(stage);
      }),
    };

    await runAiReviewPipeline(
      {
        mode: 'ci',
        branch: 'refactor/882-collapse-wrappers',
        headSha: '7777777abcdef1234567890',
        prNumber: '456',
        repo: 'Xchange-Taiwan/X-Talent-Frontend',
      },
      { llmPort, contextPort }
    );

    expect(loadIssueSpy).toHaveBeenCalledTimes(1);
    expect(requestedUrls.filter((u) => u === issueUrl)).toHaveLength(1);
    expect(requestedUrls.filter((u) => u === commentsPage1Url)).toHaveLength(1);
    expect(requestedUrls.filter((u) => u === commentsPage2Url)).toHaveLength(1);

    // Paginated comments from both page 1 and page 2 appear in planner prompt:
    expect(stagePrompts.planner).toContain('First page comment');
    expect(stagePrompts.planner).toContain('Second page comment');

    // Extracted 1 ref image + 1 PR evidence image without re-fetching issue:
    expect(stageImages.planner).toHaveLength(2);
    expect(stageImages['visual-parity']).toHaveLength(2);
    expect(stageImages.testing).toHaveLength(1);
    expect(postedComments).toHaveLength(1);
  });

  it('executes downstream review stages with bounded concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const llmPort = {
      isAvailable: () => true,
      generateJson: vi.fn(async (_prompt, { stage }) => {
        if (stage !== 'planner' && stage !== 'summary') {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 15));
          inFlight -= 1;
        }
        return buildDefaultStageMockResponse(stage);
      }),
    };

    const contextPort = {
      resolveBranch: () => 'feat/882-concurrency',
      getDiff: () => ({
        diff: [
          'diff --git a/src/components/Card.tsx b/src/components/Card.tsx',
          '+export const Card = () => null;',
        ].join(NL),
        truncated: false,
      }),
      loadIssueContext: async () => ({ ticketFound: false }),
      loadArchitectureKb: async () => ({
        matchedDesignSpecs: { rules: ['card padding'] },
      }),
      loadVisualAssets: async () => ({ refImages: [], evidenceImages: [] }),
      postPrComment: async () => {},
    };

    await runAiReviewPipeline(
      {
        mode: 'ci',
        concurrency: 2,
        headSha: '1234567abcdef',
        postComment: false,
      },
      { llmPort, contextPort }
    );

    expect(maxInFlight).toBe(2);

    // Also verify runWithConcurrency preserves deterministic task result order:
    const ordered = await runWithConcurrency(
      [
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 'first';
        },
        async () => 'second',
        async () => 'third',
      ],
      2
    );
    expect(ordered).toEqual(['first', 'second', 'third']);
  });

  it('supports STRICT_AI_REVIEW=0 graceful fallbacks and fail-closed strict mode while preserving run-local stdout schema', async () => {
    const contextPort = {
      resolveBranch: vi.fn(() => 'feat/882-local'),
      getDiff: vi.fn(() => ({
        diff: [
          'diff --git a/scripts/foo.mjs b/scripts/foo.mjs',
          '+export const x = 1;',
        ].join(NL),
        truncated: false,
      })),
      loadIssueContext: vi.fn(async () => ({ ticketFound: false })),
      loadArchitectureKb: vi.fn(async () => null),
      loadVisualAssets: vi.fn(async () => ({})),
    };

    // 1. Missing API key under STRICT_AI_REVIEW=0 (strict: false) -> fallback-in-context
    const missingKeyRelaxed = await runAiReviewPipeline(
      { mode: 'local', strict: false },
      {
        llmPort: { isAvailable: () => false, generateJson: vi.fn() },
        contextPort,
      }
    );
    expect(missingKeyRelaxed.exitCode).toBe(0);
    expect(formatLocalCliOutput(missingKeyRelaxed)).toEqual({
      mode: 'fallback-in-context',
      overallRisk: {
        level: 'low',
        reason:
          'No local GEMINI_API_KEY found under STRICT_AI_REVIEW=0. Rely on local lint/type-check/vitest and GitHub Actions CI Gemini review.',
      },
      requirementCoverage: [],
      findings: {},
    });
    expect(contextPort.getDiff).not.toHaveBeenCalled();

    // 2. Runtime LLM failure under STRICT_AI_REVIEW=0 (strict: false) -> fallback-ci
    const runtimeErrorRelaxed = await runAiReviewPipeline(
      { mode: 'local', strict: false },
      {
        llmPort: {
          isAvailable: () => true,
          generateJson: vi.fn(async () => {
            throw new Error('429 rate limited');
          }),
        },
        contextPort,
      }
    );
    expect(runtimeErrorRelaxed.exitCode).toBe(0);
    expect(formatLocalCliOutput(runtimeErrorRelaxed)).toEqual({
      mode: 'fallback-ci',
      overallRisk: {
        level: 'low',
        reason: 'Deferred to GitHub Actions CI Gemini pipeline.',
      },
      requirementCoverage: [],
      findings: {},
    });

    // 3. Fail-closed under default strict: true -> review-error + exitCode 1
    const strictFailure = await runAiReviewPipeline(
      { mode: 'local', strict: true },
      {
        llmPort: { isAvailable: () => false, generateJson: vi.fn() },
        contextPort,
      }
    );
    expect(strictFailure.exitCode).toBe(1);
    expect(strictFailure.reviewError).toBe(true);
    expect(formatLocalCliOutput(strictFailure)).toMatchObject({
      mode: 'review-error',
      reviewError: true,
      overallRisk: { level: 'high' },
    });
  });

  it('preserves HTML comment markers and wait-pr-checks convergence with single AI Review: Final Summary job (including fail-closed stage degradation)', async () => {
    const headSha = '8828820abcdef1234567890';
    const contextPort = {
      getDiff: () => ({
        diff: [
          'diff --git a/scripts/ai-review/pipeline.mjs b/scripts/ai-review/pipeline.mjs',
          '+export const ok = true;',
        ].join(NL),
        truncated: false,
      }),
      loadIssueContext: async () => ({ ticketFound: false }),
      loadArchitectureKb: async () => null,
      loadVisualAssets: async () => ({}),
      postPrComment: vi.fn(async () => {}),
    };

    const cleanRes = await runAiReviewPipeline(
      {
        mode: 'ci',
        headSha,
        prNumber: '882',
        repo: 'Xchange-Taiwan/X-Talent-Frontend',
      },
      {
        llmPort: {
          isAvailable: () => true,
          generateJson: async (_p, { stage }) =>
            buildDefaultStageMockResponse(stage),
        },
        contextPort,
      }
    );

    expect(cleanRes.comment).toContain('<!-- ai-review-pipeline -->');
    expect(cleanRes.comment).toContain(`<!-- ai-review-sha:${headSha} -->`);

    const prSingleJob = {
      headRefOid: headSha,
      mergeable: 'MERGEABLE',
      statusCheckRollup: [
        {
          __typename: 'CheckRun',
          name: 'AI Review: Final Summary',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          __typename: 'CheckRun',
          name: 'Unit & Integration Tests',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    };

    expect(evaluatePollProgress(prSingleJob).done).toBe(true);
    const convergedCheck = evaluateFinalPrConvergence(prSingleJob, [
      {
        author: { login: 'github-actions[bot]' },
        body: cleanRes.comment,
      },
    ]);
    expect(convergedCheck.riskLevel).toBe('low');
    expect(convergedCheck.converged).toBe(true);

    // Degraded core stage in CI must elevate risk to medium and block convergence:
    const degradedRes = await runAiReviewPipeline(
      {
        mode: 'ci',
        headSha,
        prNumber: '882',
        repo: 'Xchange-Taiwan/X-Talent-Frontend',
      },
      {
        llmPort: {
          isAvailable: () => true,
          generateJson: async (_p, { stage }) => {
            if (stage === 'security') {
              throw new Error('upstream timeout');
            }
            return buildDefaultStageMockResponse(stage);
          },
        },
        contextPort,
      }
    );

    expect(degradedRes.overallRisk.level).toBe('medium');
    const degradedConvergence = evaluateFinalPrConvergence(prSingleJob, [
      {
        author: { login: 'github-actions[bot]' },
        body: degradedRes.comment,
      },
    ]);
    expect(degradedConvergence.riskLevel).toBe('medium');
    expect(degradedConvergence.converged).toBe(false);
  });

  it('keeps ai-review.yml collapsed into a single Node 24 AI Review: Final Summary job with base.sha checkout and pre-merge bootstrap guard', () => {
    const workflowPath = path.resolve('.github/workflows/ai-review.yml');
    const workflowYaml = fs.readFileSync(workflowPath, 'utf8');

    expect(workflowYaml).toContain("name: 'AI Review: Final Summary'");
    expect(workflowYaml).toContain(
      'ref: ${{ github.event.pull_request.base.sha }}'
    );
    expect(workflowYaml).toContain('uses: ./.github/actions/setup-ai-agent');
    expect(workflowYaml).toContain("node-version: '24'");
    expect(workflowYaml).toContain('if [ -f scripts/ai-review/run-ci.mjs ];');
    expect(workflowYaml).not.toContain("name: 'AI Review: Planner'");
    expect(workflowYaml).not.toContain("name: 'AI Review: Security'");
  });
});
