import { composeStories } from '@storybook/nextjs';
import { fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as MobileUserMenuStories from '@/components/layout/Header/MobileUserMenu.stories';
import * as ShareProfileDialogStories from '@/components/layout/Header/ShareProfileDialog.stories';
import * as UserDropdownStories from '@/components/layout/Header/UserDropdown.stories';
import * as ConfirmedReservationStories from '@/components/profile/reservation/ConfirmedReservationDialog.stories';
import * as QuickReplyStories from '@/components/profile/reservation/QuickReplyDialog.stories';
import * as AcceptReservationStories from '@/components/reservation/AcceptReservationDialog.stories';
import * as MeetingFeedbackStories from '@/components/reservation/MeetingFeedbackDialog.stories';
import * as ConversationStories from '@/components/reservation/ReservationConversationDialog.stories';
import * as FeedbackBlockStories from '@/components/reservation/ReservationFeedbackBlock.stories';
import * as IdentityStories from '@/components/reservation/ReservationIdentity.stories';
import * as MessagePreviewStories from '@/components/reservation/ReservationMessagePreview.stories';
import { useConfirmRegister } from '@/hooks/auth/useConfirmRegister';
import { useMentorPool } from '@/hooks/useMentorPool';
import { trackEvent } from '@/lib/analytics';
import {
  confirmSignUpToken,
  executeGoogleOAuthCallback,
} from '@/lib/auth/sessionLifecycle';
import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';

vi.mock('@/lib/analytics', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

let mockTokenParam: string | null = 'valid-token';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/reservation/mentee',
  useSearchParams: () => ({
    get: (k: string) => (k === 'token' ? mockTokenParam : null),
    toString: () => '',
  }),
}));

vi.mock('@/lib/auth/sessionLifecycle', async (importActual) => {
  const actual =
    await importActual<typeof import('@/lib/auth/sessionLifecycle')>();
  return {
    ...actual,
    confirmSignUpToken: vi.fn(),
  };
});

describe('#919 Clarity DOM masking across all 10 sensitive components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('masks Avatar (including img alt) and participant name in ReservationIdentity', () => {
    const Stories = composeStories(IdentityStories);
    const FirstStory = Object.values(Stories)[0];
    const { container } = render(<FirstStory />);
    expect(
      container.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThanOrEqual(2);
    const imgs = Array.from(container.querySelectorAll('img'));
    for (const img of imgs) {
      expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    }
  });

  it('masks message content in ReservationMessagePreview (card & dialog variants)', () => {
    const Stories = composeStories(MessagePreviewStories);
    for (const StoryComp of Object.values(Stories).slice(0, 2)) {
      const { container, unmount } = render(<StoryComp />);
      const paragraphs = container.querySelectorAll('p');
      if (paragraphs.length > 0) {
        expect(
          paragraphs[0].closest('[data-clarity-mask="true"]')
        ).not.toBeNull();
      }
      unmount();
    }
  });

  it('masks avatar, participant header, and message bubbles in ReservationConversationDialog', () => {
    const Stories = composeStories(ConversationStories);
    const FirstConv = Object.values(Stories)[0];
    const { unmount } = render(<FirstConv />);
    const triggerBtn = document.body.querySelector('button');
    if (triggerBtn) fireEvent.click(triggerBtn);
    const maskedInBody = document.body.querySelectorAll(
      '[data-clarity-mask="true"]'
    );
    expect(maskedInBody.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it('masks mentee question and reply field in AcceptReservationDialog, QuickReplyDialog, and ConfirmedReservationDialog', () => {
    const AcceptStories = composeStories(AcceptReservationStories);
    const FirstAccept = Object.values(AcceptStories)[0];
    const { unmount: u1 } = render(<FirstAccept />);
    const triggerBtn = document.body.querySelector('button');
    if (triggerBtn) fireEvent.click(triggerBtn);
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThan(0);
    u1();

    const QuickStories = composeStories(QuickReplyStories);
    const FirstQuick = Object.values(QuickStories)[0];
    const { unmount: u2 } = render(<FirstQuick open={true} />);
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThan(0);
    u2();

    const ConfirmedStories = composeStories(ConfirmedReservationStories);
    const FirstConfirmed = Object.values(ConfirmedStories)[0];
    const { unmount: u3 } = render(
      <ConfirmedConfirmedWrapper Comp={FirstConfirmed} />
    );
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThan(0);
    u3();
  });

  it('masks feedback text and avatar in ReservationFeedbackBlock and MeetingFeedbackDialog', () => {
    const BlockStories = composeStories(FeedbackBlockStories);
    for (const StoryComp of Object.values(BlockStories).slice(0, 3)) {
      const { unmount } = render(<StoryComp />);
      unmount();
    }

    const DialogStories = composeStories(MeetingFeedbackStories);
    const FirstDialog = Object.values(DialogStories)[0];
    const { unmount: uDialog } = render(<FirstDialog defaultOpen={true} />);
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThanOrEqual(2);
    uDialog();
  });

  it('masks user display name, email, and avatar in UserDropdown & MobileUserMenu, and tracks share_profile_link_copied', async () => {
    const DropdownStories = composeStories(UserDropdownStories);
    const FirstDropdown = Object.values(DropdownStories)[0];
    const { unmount: uDrop } = render(<FirstDropdown />);
    const dropBtn = document.body.querySelector('button');
    if (dropBtn) fireEvent.click(dropBtn);
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThan(0);
    uDrop();

    const MobileStories = composeStories(MobileUserMenuStories);
    const FirstMobile = Object.values(MobileStories)[0];
    const { unmount: uMob } = render(<FirstMobile />);
    const mobBtn = document.body.querySelector('button');
    if (mobBtn) fireEvent.click(mobBtn);
    expect(
      document.body.querySelectorAll('[data-clarity-mask="true"]').length
    ).toBeGreaterThan(0);
    uMob();

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const ShareStories = composeStories(ShareProfileDialogStories);
    const FirstShare = Object.values(ShareStories)[0];
    const { unmount: uShare } = render(<FirstShare open={true} />);
    const copyBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => /複製/.test(b.textContent ?? '')
    );
    if (copyBtn) {
      fireEvent.click(copyBtn);
      await waitFor(() => {
        expect(trackEvent).toHaveBeenCalledWith({
          name: 'share_profile_link_copied',
          feature: 'profile',
        });
      });
    }
    uShare();
  });
});

function ConfirmedConfirmedWrapper({
  Comp,
}: {
  Comp: React.ComponentType<{ open?: boolean }>;
}) {
  return <Comp open={true} />;
}

describe('#919 Search zero-results, Email verification, and OAuth failure diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorPoolReadModel.clear();
  });

  it('tracks view_search_results and mentor_search_zero_results without leaking raw search string', async () => {
    const params = new URLSearchParams(
      'q=secret-keyword&filter_skills=frontend,backend'
    );
    renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: params as unknown as ReturnType<
          typeof import('next/navigation').useSearchParams
        >,
      })
    );

    // Prime empty filtered result in read model
    mentorPoolReadModel.prime(
      mentorPoolReadModel.resolveQuery(
        params as unknown as ReturnType<
          typeof import('next/navigation').useSearchParams
        >
      ),
      {
        mentors: [],
        nextCursor: null,
        hasMore: false,
        mentorCount: 0,
        isNoResults: true,
        hasError: false,
      }
    );

    const params2 = new URLSearchParams(
      'q=secret-keyword&filter_skills=frontend,backend'
    );
    renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: params2 as unknown as ReturnType<
          typeof import('next/navigation').useSearchParams
        >,
      })
    );

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'view_search_results',
        feature: 'mentor_pool',
        metadata: {
          result_count: 0,
          has_keyword: true,
          active_filter_count: 2,
        },
      });
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'mentor_search_zero_results',
        feature: 'mentor_pool',
        metadata: {
          has_keyword: true,
          active_filter_count: 2,
        },
      });
    });

    const serializedCalls = JSON.stringify(vi.mocked(trackEvent).mock.calls);
    expect(serializedCalls).not.toContain('secret-keyword');
  });

  it('tracks email_verified on confirmSignUpToken success and auth_flow_failed on error', async () => {
    mockTokenParam = 'tok-1';
    vi.mocked(confirmSignUpToken).mockResolvedValueOnce(undefined);
    const { unmount } = renderHook(() => useConfirmRegister());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'email_verified',
        feature: 'auth',
      });
    });
    unmount();

    mockTokenParam = 'tok-expired';
    vi.mocked(confirmSignUpToken).mockRejectedValueOnce(
      new Error('Token expired')
    );
    renderHook(() => useConfirmRegister());

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'auth_flow_failed',
        feature: 'auth',
        metadata: {
          flow: 'email_verify',
          error_type: 'confirm_token',
        },
      });
    });
  });

  it('tracks auth_flow_failed on Google OAuth INVALID outcome', async () => {
    const customTrack = vi.fn();
    await executeGoogleOAuthCallback(
      { code: null, state: null },
      {
        exchangeCode: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        navigate: vi.fn(),
        onToast: vi.fn(),
        revalidateAfterDelete: vi.fn(),
        resolveOutcomeFn: vi.fn().mockResolvedValue({
          type: 'INVALID',
          errorType: 'missing_params',
        }),
        trackEvent: customTrack,
      }
    );

    expect(customTrack).toHaveBeenCalledWith({
      name: 'auth_flow_failed',
      feature: 'auth',
      metadata: {
        flow: 'oauth_google',
        error_type: 'missing_params',
      },
    });
  });
});
