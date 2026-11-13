// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  deriveBranchNameFromIssue,
  resolveTicketBranchPlan,
} from '../.agents/scripts/link-ticket-branch.mjs';

describe('link-ticket-branch state machine', () => {
  it('reuses the headRefName of an OPEN pull request when one exists for the ticket', () => {
    const plan = resolveTicketBranchPlan({
      issueNumber: 734,
      issueObj: {
        title: '[Feature] 回饋：Mentee 送出回饋後通知 Mentor',
        linkedBranches: { nodes: [] },
        closedByPullRequestsReferences: {
          nodes: [
            { number: 1239, state: 'CLOSED', headRefName: 'feat/734-old' },
            { number: 1249, state: 'OPEN', headRefName: 'feat/734-active' },
          ],
        },
      },
      requestedBranch: '',
      openPrsByTicket: [],
      remoteBranchExists: true,
    });

    expect(plan.targetBranch).toBe('feat/734-active');
    expect(plan.hasOpenPr).toBe(true);
    expect(plan.resetToOriginDevelop).toBe(false);
  });

  it('ignores CLOSED/MERGED PRs and resets stale remote branch cleanly to origin/develop (#734 PR #1246/#1248 regression guard)', () => {
    const plan = resolveTicketBranchPlan({
      issueNumber: 734,
      issueObj: {
        title: '[Feature] 回饋：Mentee 送出回饋後通知 Mentor',
        linkedBranches: {
          nodes: [{ id: 'lb1', ref: { name: 'feat/734-mentee-mentor' } }],
        },
        closedByPullRequestsReferences: {
          nodes: [
            {
              number: 1246,
              state: 'CLOSED',
              headRefName: 'feat/734-mentee-mentor',
            },
          ],
        },
      },
      requestedBranch: '',
      openPrsByTicket: [],
      remoteBranchExists: true,
    });

    expect(plan.targetBranch).toBe('feat/734-mentee-mentor');
    expect(plan.hasOpenPr).toBe(false);
    expect(plan.resetToOriginDevelop).toBe(true);
  });

  it('preserves explicit promoted branch_name without resetting to origin/develop', () => {
    const plan = resolveTicketBranchPlan({
      issueNumber: 740,
      issueObj: {
        title: '[Feature] 登入回饋彈窗',
        linkedBranches: { nodes: [] },
        closedByPullRequestsReferences: { nodes: [] },
      },
      requestedBranch: 'feat/740-local-wip',
      openPrsByTicket: [],
      remoteBranchExists: true,
    });

    expect(plan.targetBranch).toBe('feat/740-local-wip');
    expect(plan.resetToOriginDevelop).toBe(false);
    expect(deriveBranchNameFromIssue(740, '[Bug] 修復破版')).toBe(
      'fix/740-impl'
    );
  });
});
