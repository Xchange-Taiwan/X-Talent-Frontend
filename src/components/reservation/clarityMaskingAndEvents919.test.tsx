import { composeStories } from '@storybook/nextjs';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import { trackEvent } from '@/lib/analytics';
import {
  confirmSignUpToken,
  executeGoogleOAuthCallback,
} from '@/lib/auth/sessionLifecycle';
import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';

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

  it('masks Avatar (including img alt and outer aria-label link) and participant name in ReservationIdentity', () => {
    const Stories = composeStories(IdentityStories);
    const FirstStory = Object.values(Stories)[0];
    const { container } = render(<FirstStory />);

    const ariaLink = container.querySelector('[aria-label*="個人資料"]');
    expect(ariaLink).not.toBeNull();
    expect(ariaLink!.closest('[data-clarity-mask="true"]')).not.toBeNull();

    const imgs = Array.from(container.querySelectorAll('img'));
    for (const img of imgs) {
      expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    }
  });

  it('masks message content in ReservationMessagePreview (card & dialog variants)', () => {
    const Stories = composeStories(MessagePreviewStories);
    const variants = Object.values(Stories).slice(0, 2);
    expect(variants.length).toBe(2);

    for (const StoryComp of variants) {
      const { container, unmount } = render(<StoryComp />);
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(
        paragraphs[0].closest('[data-clarity-mask="true"]')
      ).not.toBeNull();
      unmount();
    }
  });

  it('masks avatar, participant header, and message bubbles in ReservationConversationDialog', async () => {
    const user = userEvent.setup();
    const Stories = composeStories(ConversationStories);
    const FirstConv = Object.values(Stories)[0];
    const { unmount } = render(<FirstConv />);

    const triggerBtn = screen.getByRole('button', { name: /查看完整對話/ });
    await user.click(triggerBtn);

    const dialog = screen.getByRole('dialog');
    const descEl = dialog.querySelector('p');
    expect(descEl).not.toBeNull();
    expect(descEl!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    const scrollBody = dialog.querySelector('.overflow-y-auto');
    expect(scrollBody).not.toBeNull();
    expect(scrollBody!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    for (const img of Array.from(dialog.querySelectorAll('img'))) {
      expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    }
    unmount();
  });

  it('masks mentee question and reply field in AcceptReservationDialog, QuickReplyDialog, and ConfirmedReservationDialog', async () => {
    const user = userEvent.setup();

    const AcceptStories = composeStories(AcceptReservationStories);
    const FirstAccept = Object.values(AcceptStories)[0];
    const { unmount: u1 } = render(<FirstAccept />);
    const acceptTrigger = document.body.querySelector('button');
    expect(acceptTrigger).not.toBeNull();
    await user.click(acceptTrigger!);
    const acceptDialog = screen.getByRole('dialog');
    const questionHeader = screen.getByText('學員所提出的問題');
    const questionBox = questionHeader.nextElementSibling;
    expect(questionBox).not.toBeNull();
    expect(questionBox!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    const acceptReplyBtn = Array.from(
      acceptDialog.querySelectorAll('button')
    ).find((b) => /回覆|留言/.test(b.textContent ?? ''));
    expect(acceptReplyBtn).toBeDefined();
    expect(
      acceptReplyBtn!.closest('[data-clarity-mask="true"]')
    ).not.toBeNull();
    for (const img of Array.from(acceptDialog.querySelectorAll('img'))) {
      expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    }
    u1();

    const QuickStories = composeStories(QuickReplyStories);
    const FirstQuick = Object.values(QuickStories)[0];
    const { unmount: u2 } = render(<FirstQuick open={true} />);
    const quickDialog = screen.getByRole('dialog');
    const quickProfileLink = quickDialog.querySelector(
      '[aria-label*="個人資料"]'
    );
    expect(quickProfileLink).not.toBeNull();
    expect(
      quickProfileLink!.closest('[data-clarity-mask="true"]')
    ).not.toBeNull();
    const quickReplyBtn = Array.from(
      quickDialog.querySelectorAll('button')
    ).find((b) => /回覆|留言/.test(b.textContent ?? ''));
    expect(quickReplyBtn).toBeDefined();
    expect(quickReplyBtn!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    u2();

    const ConfirmedStories = composeStories(ConfirmedReservationStories);
    const FirstConfirmed = Object.values(ConfirmedStories)[0];
    const { unmount: u3 } = render(<FirstConfirmed open={true} />);
    const confirmedDialog = screen.getByRole('dialog');
    const confirmedProfileLink = confirmedDialog.querySelector(
      '[aria-label*="個人資料"]'
    );
    expect(confirmedProfileLink).not.toBeNull();
    expect(
      confirmedProfileLink!.closest('[data-clarity-mask="true"]')
    ).not.toBeNull();
    u3();
  });

  it('masks feedback text and author name in ReservationFeedbackBlock and MeetingFeedbackDialog', () => {
    const BlockStories = composeStories(FeedbackBlockStories);

    const { unmount: uMentee } = render(<BlockStories.MenteePublicRating />);
    const menteeComment = screen.getByText(/導師給了非常具體的作品集優化方向/);
    expect(menteeComment.closest('[data-clarity-mask="true"]')).not.toBeNull();
    uMentee();

    const { unmount: uMentor } = render(<BlockStories.MentorPublicRating />);
    const mentorComment = screen.getByText(/問題拆解清晰/);
    const maskedAuthor = screen.getByText('王＊明');
    expect(mentorComment.closest('[data-clarity-mask="true"]')).not.toBeNull();
    expect(maskedAuthor.closest('[data-clarity-mask="true"]')).not.toBeNull();
    uMentor();

    const DialogStories = composeStories(MeetingFeedbackStories);
    const FirstDialog = Object.values(DialogStories)[0];
    const { unmount: uDialog } = render(<FirstDialog defaultOpen={true} />);
    const fbDialog = screen.getByRole('dialog');
    const fbHeader = screen.getByTestId('feedback-mentor-header');
    const headerName = fbHeader.querySelector('p');
    expect(headerName).not.toBeNull();
    expect(headerName!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    const fbFormScrollBody = fbDialog.querySelector('form .overflow-y-auto');
    expect(fbFormScrollBody).not.toBeNull();
    expect(
      fbFormScrollBody!.closest('[data-clarity-mask="true"]')
    ).not.toBeNull();
    for (const img of Array.from(fbHeader.querySelectorAll('img'))) {
      expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    }
    uDialog();
  });

  it('opens UserDropdown & MobileUserMenu via userEvent to verify UserAvatar img and displayName/email masking, and tracks share_profile_link_copied', async () => {
    const user = userEvent.setup();

    const DropdownStories = composeStories(UserDropdownStories);
    const FirstDropdown = Object.values(DropdownStories)[0];
    const { unmount: uDrop } = render(<FirstDropdown />);
    const dropTrigger = document.body.querySelector('button');
    expect(dropTrigger).not.toBeNull();
    const triggerAvatarImg = dropTrigger!.querySelector('img');
    expect(triggerAvatarImg).not.toBeNull();
    expect(
      triggerAvatarImg!.closest('[data-clarity-mask="true"]')
    ).not.toBeNull();
    await user.click(dropTrigger!);

    const menuEl = screen.getByRole('menu');
    const menuAvatarImg = menuEl.querySelector('img');
    expect(menuAvatarImg).not.toBeNull();
    expect(menuAvatarImg!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    const nameNode = menuEl.querySelector('.truncate.font-semibold');
    expect(nameNode).not.toBeNull();
    expect(nameNode!.textContent?.trim().length).toBeGreaterThan(0);
    expect(nameNode!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    uDrop();

    const MobileStories = composeStories(MobileUserMenuStories);
    const FirstMobile = Object.values(MobileStories)[0];
    const { unmount: uMob } = render(<FirstMobile />);
    const mobTrigger = document.body.querySelector('button');
    expect(mobTrigger).not.toBeNull();
    await user.click(mobTrigger!);

    const sheetDialog = screen.getByRole('dialog');
    const mobAvatarImg = sheetDialog.querySelector('img');
    expect(mobAvatarImg).not.toBeNull();
    expect(mobAvatarImg!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    const mobNameNode = sheetDialog.querySelector('.truncate.font-semibold');
    expect(mobNameNode).not.toBeNull();
    expect(mobNameNode!.textContent?.trim().length).toBeGreaterThan(0);
    expect(mobNameNode!.closest('[data-clarity-mask="true"]')).not.toBeNull();
    uMob();

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    const ShareStories = composeStories(ShareProfileDialogStories);
    const FirstShare = Object.values(ShareStories)[0];
    const { unmount: uShare } = render(<FirstShare open={true} />);
    const copyBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => /複製/.test(b.textContent ?? '')
    );
    expect(copyBtn).toBeDefined();
    fireEvent.click(copyBtn!);

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'share_profile_link_copied',
        feature: 'profile',
      });
    });
    uShare();
  });
});

describe('#919 Search zero-results, Email verification, OAuth failures, and schedule sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorPoolReadModel.clear();
    scheduleReadModel.clear();
  });

  it('tracks view_search_results and mentor_search_zero_results without leaking raw search string', async () => {
    const params = new URLSearchParams(
      'q=secret-keyword&filter_skills=frontend,backend'
    );
    await act(async () => {
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
    });

    renderHook(() =>
      useMentorPool({
        initialMentors: [],
        initialMentorCount: 0,
        params: params as unknown as ReturnType<
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

  it('covers unfiltered no-op, non-zero results without zero_results event, pagination deduplication, error guard, and filter clear reset', async () => {
    type ParamsType = ReturnType<
      typeof import('next/navigation').useSearchParams
    >;

    // 1. Unfiltered browse does not fire view_search_results
    const emptyParams = new URLSearchParams('') as unknown as ParamsType;
    const { rerender } = renderHook(
      ({ p }: { p: ParamsType }) =>
        useMentorPool({
          initialMentors: [],
          initialMentorCount: 5,
          params: p,
        }),
      { initialProps: { p: emptyParams } }
    );
    expect(trackEvent).not.toHaveBeenCalled();

    // 2. Non-zero filtered result fires ONLY view_search_results (not mentor_search_zero_results) and deduplicates across pagination count updates
    const filteredParams = new URLSearchParams(
      'filter_topics=career_transition'
    ) as unknown as ParamsType;
    const qObj = mentorPoolReadModel.resolveQuery(filteredParams);
    await act(async () => {
      mentorPoolReadModel.prime(qObj, {
        mentors: [{ user_id: 1 } as never],
        nextCursor: 'c2',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });
    });

    rerender({ p: filteredParams });
    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledTimes(1);
    });
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'view_search_results',
      feature: 'mentor_pool',
      metadata: {
        result_count: 1,
        has_keyword: false,
        active_filter_count: 1,
      },
    });

    // Simulate loadMore updating mentorCount for same query -> must NOT re-fire view_search_results
    await act(async () => {
      mentorPoolReadModel.prime(qObj, {
        mentors: [{ user_id: 1 } as never, { user_id: 2 } as never],
        nextCursor: null,
        hasMore: false,
        mentorCount: 2,
        isNoResults: false,
        hasError: false,
      });
    });
    rerender({ p: filteredParams });
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // 3. Clearing filters resets dedup ref so re-applying the same filter fires again
    rerender({ p: emptyParams });
    rerender({ p: filteredParams });
    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledTimes(2);
    });

    // 4. Error state does NOT fire view_search_results
    vi.mocked(trackEvent).mockClear();
    const errParams = new URLSearchParams('q=boom') as unknown as ParamsType;
    await act(async () => {
      mentorPoolReadModel.prime(mentorPoolReadModel.resolveQuery(errParams), {
        mentors: [],
        nextCursor: null,
        hasMore: false,
        mentorCount: 0,
        isNoResults: false,
        hasError: true,
      });
    });
    rerender({ p: errParams });
    expect(trackEvent).not.toHaveBeenCalled();
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

  it('tracks auth_flow_failed on Google OAuth INVALID and LOGIN missing_login_data outcomes', async () => {
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

    customTrack.mockClear();
    await executeGoogleOAuthCallback(
      { code: 'c1', state: 's1' },
      {
        exchangeCode: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        navigate: vi.fn(),
        onToast: vi.fn(),
        revalidateAfterDelete: vi.fn(),
        resolveOutcomeFn: vi.fn().mockResolvedValue({
          type: 'LOGIN',
          data: { auth: { token: '' }, user: null },
        }),
        trackEvent: customTrack,
      }
    );

    expect(customTrack).toHaveBeenCalledWith({
      name: 'auth_flow_failed',
      feature: 'auth',
      metadata: {
        flow: 'oauth_google',
        error_type: 'missing_login_data',
      },
    });
  });

  it('preserves slotsSnapshot.monthLoaded while exposing reader.isMonthSynced once MonthDraftStore mirrors scheduleRead', async () => {
    scheduleReadModel.set({ userId: '777', year: 2026, month: 11 }, []);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '777', year: 2026, month: 11 },
      })
    );

    expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
    await waitFor(() => {
      expect(result.current.reader.isMonthSynced).toBe(true);
    });
  });
});
