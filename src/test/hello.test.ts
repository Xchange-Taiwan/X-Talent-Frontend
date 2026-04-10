import { describe, expect, it } from 'vitest';

describe('vitest setup', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should resolve path aliases', async () => {
    // Verify that @/ alias resolves correctly by importing a real module
    const { cn } = await import('@/lib/utils');
    expect(typeof cn).toBe('function');
  });
});
