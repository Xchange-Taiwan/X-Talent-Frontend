// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  deriveBranchNameFromIssue,
  queryBranchOpenPrState,
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

  it('reuses openPrsByTicket fallback when GraphQL closedByPullRequestsReferences is empty', () => {
    const plan = resolveTicketBranchPlan({
      issueNumber: 735,
      issueObj: {
        title: '[Feature] Mentor 回饋顯示',
        linkedBranches: { nodes: [] },
        closedByPullRequestsReferences: { nodes: [] },
      },
      requestedBranch: '',
      openPrsByTicket: [{ number: 1247, headRefName: 'feat/735-mentor' }],
      remoteBranchExists: true,
    });

    expect(plan.targetBranch).toBe('feat/735-mentor');
    expect(plan.hasOpenPr).toBe(true);
    expect(plan.resetToOriginDevelop).toBe(false);
  });

  it('does not reset when remote branch does not exist yet and ignores develop/main as requestedBranch', () => {
    const plan = resolveTicketBranchPlan({
      issueNumber: 830,
      issueObj: {
        title: '[Feature] Mentor Profile v2',
        linkedBranches: { nodes: [] },
        closedByPullRequestsReferences: {
          nodes: [{ number: 1200, state: 'MERGED', headRefName: 'feat/830-v1' }],
        },
      },
      requestedBranch: 'develop',
      openPrsByTicket: [],
      remoteBranchExists: false,
    });

    expect(plan.targetBranch).toBe('feat/830-mentor-profile-v2');
    expect(plan.hasOpenPr).toBe(false);
    expect(plan.resetToOriginDevelop).toBe(false);
  });

  it('fails closed (refuses resetToOriginDevelop) when direct --head open-PR query fails or finds an unlinked open PR', () => {
    const failedQuery = queryBranchOpenPrState({
      org: 'Xchange-Taiwan',
      frontendRepo: 'X-Talent-Frontend',
      targetBranch: 'feat/734-mentee-mentor',
      execGh: () => '',
    });
    expect(failedQuery.ok).toBe(false);

    const planOnApiFailure = resolveTicketBranchPlan({
      issueNumber: 734,
      issueObj: {
        title: '[Feature] 回饋通知',
        linkedBranches: {
          nodes: [{ id: 'lb1', ref: { name: 'feat/734-mentee-mentor' } }],
        },
        closedByPullRequestsReferences: { nodes: [] },
      },
      requestedBranch: '',
      openPrsByTicket: [],
      remoteBranchExists: true,
      directBranchOpenPrCheck: failedQuery,
    });
    expect(planOnApiFailure.resetToOriginDevelop).toBe(false);

    const foundUnlinkedQuery = queryBranchOpenPrState({
      org: 'Xchange-Taiwan',
      frontendRepo: 'X-Talent-Frontend',
      targetBranch: 'feat/custom-branch',
      execGh: () => '[{"number":1299,"headRefName":"feat/custom-branch"}]',
    });
    expect(foundUnlinkedQuery.ok).toBe(true);
    expect(foundUnlinkedQuery.hasOpenPr).toBe(true);

    const planWithUnlinkedOpenPr = resolveTicketBranchPlan({
      issueNumber: 734,
      issueObj: {
        title: '[Feature] 回饋通知',
        linkedBranches: {
          nodes: [{ id: 'lb2', ref: { name: 'feat/custom-branch' } }],
        },
        closedByPullRequestsReferences: { nodes: [] },
      },
      requestedBranch: '',
      openPrsByTicket: [],
      remoteBranchExists: true,
      directBranchOpenPrCheck: foundUnlinkedQuery,
    });
    expect(planWithUnlinkedOpenPr.hasOpenPr).toBe(true);
    expect(planWithUnlinkedOpenPr.resetToOriginDevelop).toBe(false);
  });
});
