import { describe, it, expect } from 'vitest';
import { categorizeChecks, isTimeout } from '../.agents/scripts/pr-parser.mjs';

describe('categorizeChecks', () => {
  it('should categorize successful and skipped checks as passing', () => {
    const mockChecks = [
      { name: 'build', bucket: 'pass' },
      { name: 'lint', state: 'success' },
      { name: 'deploy', bucket: 'skipping' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(3);
    expect(pending).toHaveLength(0);
    expect(failing).toHaveLength(0);
  });

  it('should categorize pending and queued checks as pending', () => {
    const mockChecks = [
      { name: 'build', bucket: 'pending' },
      { name: 'test', state: 'in_progress' },
      { name: 'lint', state: 'queued' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(0);
    expect(pending).toHaveLength(3);
    expect(failing).toHaveLength(0);
  });

  it('should categorize failing and cancelled checks as failing', () => {
    const mockChecks = [
      { name: 'build', bucket: 'fail' },
      { name: 'test', state: 'failed' },
      { name: 'lint', bucket: 'cancel' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(0);
    expect(pending).toHaveLength(0);
    expect(failing).toHaveLength(3);
  });
});

describe('isTimeout', () => {
  it('should return false if elapsed time is within timeout', () => {
    const startTime = 1000;
    const maxTimeout = 5000;
    const currentTime = 3000;
    expect(isTimeout(startTime, maxTimeout, currentTime)).toBe(false);
  });

  it('should return true if elapsed time exceeds timeout', () => {
    const startTime = 1000;
    const maxTimeout = 5000;
    const currentTime = 7000;
    expect(isTimeout(startTime, maxTimeout, currentTime)).toBe(true);
  });
});
