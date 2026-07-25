// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ai-review/lib/gemini.mjs', () => ({
  callGemini: vi.fn(),
}));

const { callGemini } = await import('../../ai-review/lib/gemini.mjs');
const { planScenarios } = await import('./scenario-planner.mjs');

const ticket = {
  number: 318,
  title: 'AI QA Agent',
  body: 'test',
  comments: [],
};

beforeEach(() => {
  callGemini.mockReset();
});

describe('planScenarios', () => {
  it('returns not-applicable with no scenarios when the planner says so', async () => {
    callGemini.mockResolvedValue({ applicable: false, reason: '純後端改動' });
    const plan = await planScenarios({ ticket, baseRef: 'HEAD' });
    expect(plan).toEqual({
      applicable: false,
      reason: '純後端改動',
      scenarios: [],
    });
  });

  it('keeps only valid scenarios and caps at MAX_SCENARIOS', async () => {
    callGemini.mockResolvedValue({
      applicable: true,
      scenarios: [
        {
          id: 'a',
          role: 'visitor',
          route: '/',
          description: 'd',
          expected: 'e',
        },
        { id: 'b', role: 'not-a-real-role', description: 'd', expected: 'e' }, // invalid role
        { id: 'c', role: 'mentee', description: 'd', expected: 'e' }, // no route -> defaults to '/'
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `extra-${i}`,
          role: 'visitor',
          description: 'd',
          expected: 'e',
        })),
      ],
    });

    const plan = await planScenarios({ ticket, baseRef: 'HEAD' });
    expect(plan.applicable).toBe(true);
    expect(plan.scenarios.length).toBe(5);
    expect(plan.scenarios.some((s) => s.id === 'b')).toBe(false);
    expect(plan.scenarios.find((s) => s.id === 'c').route).toBe('/');
  });

  it('falls back to not-applicable when applicable:true but every scenario is invalid', async () => {
    callGemini.mockResolvedValue({
      applicable: true,
      scenarios: [{ id: 'bad', role: 'not-a-role' }],
    });

    const plan = await planScenarios({ ticket, baseRef: 'HEAD' });
    expect(plan.applicable).toBe(false);
    expect(plan.scenarios).toEqual([]);
  });

  it('degrades to not-applicable (not a throw) when plan.scenarios is not an array', async () => {
    // Same malformed-LLM-output class as fixture-planner.mjs — plan.scenarios
    // being a string/object instead of a list must not throw a TypeError.
    callGemini.mockResolvedValue({
      applicable: true,
      scenarios: 'not-an-array',
    });

    const plan = await planScenarios({ ticket, baseRef: 'HEAD' });
    expect(plan.applicable).toBe(false);
    expect(plan.scenarios).toEqual([]);
  });
});
