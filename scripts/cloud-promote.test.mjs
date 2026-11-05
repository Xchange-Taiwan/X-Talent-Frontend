// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  buildWorkflowDispatchArgs,
  parsePromoteArgs,
  validateBranchForPromote,
} from './cloud-promote.mjs';

describe('cloud-promote', () => {
  describe('validateBranchForPromote', () => {
    it('rejects empty, protected, or unsafe branch names', () => {
      expect(validateBranchForPromote('').valid).toBe(false);
      expect(validateBranchForPromote('develop').valid).toBe(false);
      expect(validateBranchForPromote('main').valid).toBe(false);
      expect(validateBranchForPromote('../evil').valid).toBe(false);
      expect(validateBranchForPromote('-flag').valid).toBe(false);
    });

    it('accepts standard feature and fix branch names', () => {
      expect(validateBranchForPromote('feat/822-reservation-e2e')).toEqual({
        valid: true,
        branchName: 'feat/822-reservation-e2e',
      });
    });
  });

  describe('parsePromoteArgs & buildWorkflowDispatchArgs', () => {
    it('extracts ticket number from branch name automatically', () => {
      const parsed = parsePromoteArgs([], 'feat/822-reservation-e2e');
      expect(parsed.ticketNumber).toBe('822');
      expect(parsed.branchName).toBe('feat/822-reservation-e2e');
      expect(parsed.maxRounds).toBe(20);
      expect(parsed.runE2e).toBe(true);
    });

    it('allows overriding ticket number, maxRounds, and extraPrompt via CLI flags', () => {
      const parsed = parsePromoteArgs(
        [
          '--ticket=825',
          '--max-rounds=15',
          '--run-e2e=false',
          '--prompt=check RWD',
        ],
        'chore/custom-branch'
      );
      expect(parsed).toEqual({
        ticketNumber: '825',
        branchName: 'chore/custom-branch',
        maxRounds: 15,
        runE2e: false,
        extraPrompt: 'check RWD',
        noCommit: false,
      });

      const ghArgs = buildWorkflowDispatchArgs(parsed);
      expect(ghArgs).toEqual([
        'workflow',
        'run',
        'cloud-implement.yml',
        '--repo',
        'Xchange-Taiwan/X-Talent-Frontend',
        '-f',
        'ticket_number=825',
        '-f',
        'branch_name=chore/custom-branch',
        '-f',
        'max_review_rounds=15',
        '-f',
        'run_e2e=false',
        '-f',
        'extra_prompt=check RWD',
      ]);
    });
  });
});
