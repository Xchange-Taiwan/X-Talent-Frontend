// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ai-review/lib/gemini.mjs', () => ({
  callGemini: vi.fn(),
}));

const { callGemini } = await import('../../ai-review/lib/gemini.mjs');
const { planFixtures } = await import('./fixture-planner.mjs');

const ticket = {
  number: 318,
  title: 'AI QA Agent',
  body: 'test',
  comments: [],
};

beforeEach(() => {
  callGemini.mockReset();
});

describe('planFixtures', () => {
  it('keeps only valid fixtures and drops malformed ones', async () => {
    callGemini.mockResolvedValue({
      fixtures: [
        {
          method: 'GET',
          path: '/v1/jobs/1',
          status: 200,
          body: { data: { id: 1 } },
        },
        { method: 'TRACE', path: '/v1/jobs/2', status: 200, body: {} }, // invalid method
        { method: 'GET', path: 'not-a-path', status: 200, body: {} }, // missing leading slash
        { method: 'GET', path: '/v1/jobs/3', status: 700, body: {} }, // invalid status
        { method: 'GET', path: '/v1/jobs/4', status: 200, body: null }, // missing body
      ],
    });

    const fixtures = await planFixtures({ ticket, baseRef: 'HEAD' });
    expect(fixtures).toEqual([
      {
        method: 'GET',
        path: '/v1/jobs/1',
        status: 200,
        body: { data: { id: 1 } },
      },
    ]);
  });

  it('never lets the planner override the baseline /v1/auth/login route', async () => {
    callGemini.mockResolvedValue({
      fixtures: [
        {
          method: 'POST',
          path: '/v1/auth/login',
          status: 200,
          body: { data: {} },
        },
      ],
    });

    const fixtures = await planFixtures({ ticket, baseRef: 'HEAD' });
    expect(fixtures).toEqual([]);
  });

  it('caps the number of fixtures', async () => {
    callGemini.mockResolvedValue({
      fixtures: Array.from({ length: 20 }, (_, i) => ({
        method: 'GET',
        path: `/v1/thing/${i}`,
        status: 200,
        body: { data: {} },
      })),
    });

    const fixtures = await planFixtures({ ticket, baseRef: 'HEAD' });
    expect(fixtures.length).toBe(8);
  });

  it('returns an empty array (not a throw) when the Gemini call fails', async () => {
    callGemini.mockRejectedValue(new Error('network error'));
    await expect(planFixtures({ ticket, baseRef: 'HEAD' })).resolves.toEqual(
      []
    );
  });

  it('returns an empty array when the planner response has no fixtures field', async () => {
    callGemini.mockResolvedValue({});
    await expect(planFixtures({ ticket, baseRef: 'HEAD' })).resolves.toEqual(
      []
    );
  });
});
