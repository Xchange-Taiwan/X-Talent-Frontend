// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  evaluateFinalPrConvergence,
  evaluatePollProgress,
} from '../.agents/scripts/wait-pr-checks.mjs';

describe('wait-pr-checks convergence state machine', () => {
  it('waits for AI Review: Final Summary when upstream AI Review checks are present even if >=5 checks completed', () => {
    const prEarly = {
      statusCheckRollup: [
        {
          name: 'AI Review: Planner',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          name: 'Unit & Integration Tests',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          name: 'Format and Lint Check',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          name: 'Bundle Size Budget Check',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          name: 'OpenAPI Types Check',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    };
    expect(evaluatePollProgress(prEarly).done).toBe(false);

    const prDone = {
      statusCheckRollup: [
        ...prEarly.statusCheckRollup,
        {
          name: 'AI Review: Final Summary',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    };
    expect(evaluatePollProgress(prDone).done).toBe(true);
  });

  it('does NOT exempt Deploy PR Preview to Vercel when next build fails (no HEAD-matched quota comment), even with stale label or native Vercel status', () => {
    const prBuildBroken = {
      headRefOid: '2222222abcdef1234567890',
      mergeable: 'MERGEABLE',
      labels: [{ name: 'vercel-quota-limit' }],
      statusCheckRollup: [
        {
          __typename: 'StatusContext',
          context: 'Vercel',
          state: 'FAILURE',
          description:
            'Resource is limited - try again in 4 hours (api-deployments-free-per-day)',
        },
        {
          __typename: 'CheckRun',
          name: 'Deploy PR Preview to Vercel',
          status: 'COMPLETED',
          conclusion: 'FAILURE',
        },
        {
          __typename: 'CheckRun',
          name: 'AI Review: Final Summary',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    };
    const commentsWithOldSha = [
      {
        author: { login: 'github-actions[bot]' },
        body: '<!-- vercel-quota-limit:sha=1111111oldsha --> quota reached earlier',
      },
      {
        author: { login: 'github-actions[bot]' },
        body: '<!-- ai-review-pipeline -->\n<!-- ai-review-sha:2222222abcdef1234567890 -->\n### ⚠️ Overall Risk\n**low** — Clean',
      },
    ];

    const res = evaluateFinalPrConvergence(prBuildBroken, commentsWithOldSha);
    expect(res.converged).toBe(false);
    expect(res.failedChecks).toContain('Deploy PR Preview to Vercel (FAILURE)');
  });

  it('exempts Deploy PR Preview to Vercel ONLY when completed and quota comment matches current headRefOid, and rejects stale AI Review SHA', () => {
    const headSha = '9999999abcdef1234567890';
    const prQuotaOnly = {
      headRefOid: headSha,
      mergeable: 'MERGEABLE',
      statusCheckRollup: [
        {
          __typename: 'CheckRun',
          name: 'Deploy PR Preview to Vercel',
          status: 'COMPLETED',
          conclusion: 'FAILURE',
        },
        {
          __typename: 'CheckRun',
          name: 'Unit & Integration Tests',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
        {
          __typename: 'CheckRun',
          name: 'AI Review: Final Summary',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    };

    const staleAiComments = [
      {
        author: { login: 'github-actions[bot]' },
        body: `<!-- vercel-quota-limit:sha=${headSha} --> quota hit after vercel build passed`,
      },
      {
        author: { login: 'github-actions[bot]' },
        body: '<!-- ai-review-pipeline -->\n<!-- ai-review-sha=0000000stale -->\n### ⚠️ Overall Risk\n**low** — Old',
      },
    ];
    // Fix marker syntax test with colon:
    staleAiComments[1].body =
      '<!-- ai-review-pipeline -->\n<!-- ai-review-sha:0000000stale -->\n### ⚠️ Overall Risk\n**low** — Old';

    const staleRes = evaluateFinalPrConvergence(prQuotaOnly, staleAiComments);
    expect(staleRes.failedChecks).toEqual([]);
    expect(staleRes.riskLevel).toBe('unknown');
    expect(staleRes.converged).toBe(false);

    const freshComments = [
      staleAiComments[0],
      {
        author: { login: 'github-actions[bot]' },
        body: `<!-- ai-review-pipeline -->\n<!-- ai-review-sha:${headSha} -->\n### ⚠️ Overall Risk\n**low** — All good`,
      },
    ];
    const freshRes = evaluateFinalPrConvergence(prQuotaOnly, freshComments);
    expect(freshRes.vercelQuotaReached).toBe(true);
    expect(freshRes.converged).toBe(true);
  });
});
