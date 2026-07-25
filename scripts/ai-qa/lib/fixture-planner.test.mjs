// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ai-review/lib/gemini.mjs', () => ({
  callGemini: vi.fn(),
}));

const { callGemini } = await import('../../ai-review/lib/gemini.mjs');
const { isValidFixture, planFixtures } = await import('./fixture-planner.mjs');

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

  it('returns an empty array (not a throw) when plan.fixtures is not an array', async () => {
    // A model that returns a malformed shape (string/object instead of a
    // list) must degrade gracefully — this used to call .filter() directly
    // on whatever came back and threw a TypeError, aborting the whole QA run.
    callGemini.mockResolvedValue({ fixtures: 'not-an-array' });
    await expect(planFixtures({ ticket, baseRef: 'HEAD' })).resolves.toEqual(
      []
    );
  });
});

describe('isValidFixture', () => {
  const valid = {
    method: 'GET',
    path: '/v1/jobs/1',
    status: 200,
    body: { data: {} },
  };

  it('accepts a well-formed fixture', () => {
    expect(isValidFixture(valid)).toBe(true);
  });

  it('rejects an unsupported HTTP method', () => {
    expect(isValidFixture({ ...valid, method: 'TRACE' })).toBe(false);
  });

  it('rejects a path missing the leading slash', () => {
    expect(isValidFixture({ ...valid, path: 'v1/jobs/1' })).toBe(false);
  });

  it('rejects the reserved /v1/auth/login path (baseline handler owns it)', () => {
    expect(isValidFixture({ ...valid, path: '/v1/auth/login' })).toBe(false);
  });

  it.each([99, 600, -1, '200'])('rejects an invalid status %p', (status) => {
    expect(isValidFixture({ ...valid, status })).toBe(false);
  });

  it.each([undefined, null, 'a string body', 42])(
    'rejects a missing/non-object body %p',
    (body) => {
      expect(isValidFixture({ ...valid, body })).toBe(false);
    }
  );

  it('rejects a null/undefined fixture', () => {
    expect(isValidFixture(null)).toBeFalsy();
    expect(isValidFixture(undefined)).toBeFalsy();
  });
});
