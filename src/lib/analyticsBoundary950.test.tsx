import { act, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from '@/components/layout/Header/NotificationBell';
import { WhoAreYou } from '@/components/onboarding/steps/WhoAreYou';
import { AvatarCard } from '@/components/profile/avatar-card/AvatarCard';
import MentorScheduleDialog from '@/components/profile/reservation/MentorScheduleDialog';
import { useGoogleAuth } from '@/hooks/auth/useGoogleAuth';
import { useOnboardingForm } from '@/hooks/user/onboarding/useOnboardingForm';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { usePendingFeedbackQueue } from '@/hooks/user/reservation/usePendingFeedbackQueue';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import {
  initClarity,
  initGa4,
  registerClarityMetadataListener,
  resetAnalyticsUserState,
  trackFormValidationFailed,
} from '@/lib/analytics';
import type {
  BookingCalendarReader,
  MentorScheduleEditor,
} from '@/lib/profile/bookingAvailability';
import { createFeedbackSessionCoordinator } from '@/lib/reservation/feedbackSessionCoordinator';
import type { Reservation } from '@/types/reservation';

const mockPush = vi.fn();
let mockPathname = '/mentor-pool';
const mockSearchParams = new URLSearchParams();
const mockSessionState: {
  data: {
    user: {
      id: string;
      name?: string;
      isMentor: boolean;
      onBoarding: boolean;
    };
    error?: string;
  } | null;
  status: 'authenticated' | 'unauthenticated' | 'loading';
  update: ReturnType<typeof vi.fn>;
} = {
  data: {
    user: {
      id: '9001',
      name: '王小明 Real Name',
      isMentor: false,
      onBoarding: true,
    },
    error: undefined,
  },
  status: 'authenticated',
  update: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockSessionState,
}));

const mockInitiateGoogleAuth = vi.fn();
vi.mock('@/lib/auth/sessionLifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/sessionLifecycle')>();
  return {
    ...actual,
    initiateGoogleAuth: (...args: unknown[]) => mockInitiateGoogleAuth(...args),
  };
});

const mockFetchReservationMeetLink = vi.fn();
const mockSubmitReservationFeedback = vi.fn();
const mockFetchPendingFeedbackReservations = vi.fn();
vi.mock('@/services/reservations', () => ({
  fetchReservationMeetLink: (...args: unknown[]) =>
    mockFetchReservationMeetLink(...args),
  submitReservationFeedback: (...args: unknown[]) =>
    mockSubmitReservationFeedback(...args),
  fetchPendingFeedbackReservations: (...args: unknown[]) =>
    mockFetchPendingFeedbackReservations(...args),
}));

const mockUpdateAvatar = vi.fn();
vi.mock('@/services/profile/updateAvatar', () => ({
  createPresignedUrlCache: () => ({ prefetch: vi.fn() }),
  updateAvatar: (...args: unknown[]) => mockUpdateAvatar(...args),
}));

vi.mock('@/services/profile/getAvatarSnapshot', () => ({
  getAvatarSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/featureFlags')>();
  return {
    ...actual,
    isFeedbackEnabled: () => true,
  };
});

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    keys: () => Array.from(map.keys()),
  };
}

describe('Analytics Boundary, Pre-DB Diagnostics & Clarity Masking (#950)', () => {
  let gtagCalls: unknown[][];
  let clarityCalls: unknown[][];

  beforeEach(() => {
    resetAnalyticsUserState();
    gtagCalls = [];
    clarityCalls = [];
    mockPush.mockReset();
    mockInitiateGoogleAuth.mockReset();
    mockFetchReservationMeetLink.mockReset();
    mockSubmitReservationFeedback.mockReset();
    mockFetchPendingFeedbackReservations.mockReset();
    mockUpdateAvatar.mockReset();
    mockPathname = '/mentor-pool';

    window.dataLayer = [];
    window.gtag = vi.fn((...args: unknown[]) => {
      gtagCalls.push(args);
    }) as unknown as Window['gtag'];

    const clarityFn = vi.fn((...args: unknown[]) => {
      clarityCalls.push(args);
      if (args[0] === 'metadata' && typeof args[1] === 'function') {
        (args[1] as (p: unknown) => void)({
          projectId: 'vwimm8rumd',
          userId: 'clarityUser1',
          sessionId: 'claritySess1',
        });
      }
    });
    Object.assign(clarityFn, { q: [] });
    window.clarity = clarityFn as unknown as Window['clarity'];

    initGa4('G-TEST950ABC');
    initClarity('vwimm8rumd');
    registerClarityMetadataListener();
    gtagCalls.length = 0;
    clarityCalls.length = 0;
  });

  afterEach(() => {
    resetAnalyticsUserState();
    vi.restoreAllMocks();
  });

  it('trackFormValidationFailed normalizes allowlisted field keys, strips raw/PII strings, attaches clarity_playback_url, and upgrades Clarity session', () => {
    trackFormValidationFailed({
      feature: 'profile',
      formId: 'mentor_onboarding',
      invalidKeys: [
        'name',
        'avatarFile',
        'work_experiences.0.company',
        '王小明@example.com',
      ],
    });

    const eventCall = gtagCalls.find(
      (c) => c[0] === 'event' && c[1] === 'form_validation_failed'
    );
    expect(eventCall).toBeDefined();
    const payload = eventCall?.[2] as Record<string, unknown>;
    expect(payload).toMatchObject({
      feature: 'profile',
      form_id: 'mentor_onboarding',
      primary_field: 'profile_name',
      invalid_count: 4,
      clarity_playback_url:
        'https://clarity.microsoft.com/player/vwimm8rumd/clarityUser1/claritySess1',
    });

    const serialized = JSON.stringify(gtagCalls);
    expect(serialized).not.toContain('王小明');
    expect(serialized).not.toContain('example.com');

    expect(clarityCalls).toContainEqual(['upgrade', 'form_validation_failed']);
  });

  it('useOnboardingForm emits form_validation_failed with step when advanceStep fails validation without leaking user values', async () => {
    const { result } = renderHook(() => useOnboardingForm({ industries: [] }));

    act(() => {
      result.current.form.setValue('name', '');
    });

    let advanced = true;
    await act(async () => {
      advanced = await result.current.advanceStep();
    });

    expect(advanced).toBe(false);
    const eventCall = gtagCalls.find(
      (c) => c[0] === 'event' && c[1] === 'form_validation_failed'
    );
    expect(eventCall).toBeDefined();
    expect(eventCall?.[2]).toMatchObject({
      feature: 'onboarding',
      form_id: 'mentee_onboarding',
      primary_field: 'profile_name',
      step: 1,
    });
    expect(JSON.stringify(gtagCalls)).not.toContain('王小明');
  });

  it('useGoogleAuth emits auth_oauth_started prior to Google redirect for both login and sign_up', async () => {
    mockInitiateGoogleAuth.mockResolvedValue(undefined);
    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });
    await act(async () => {
      await result.current.handleGoogleAuth(false);
    });

    const oauthEvents = gtagCalls.filter(
      (c) => c[0] === 'event' && c[1] === 'auth_oauth_started'
    );
    expect(oauthEvents).toHaveLength(2);
    expect(oauthEvents[0]?.[2]).toMatchObject({
      feature: 'auth',
      method: 'Google',
      flow: 'login',
    });
    expect(oauthEvents[1]?.[2]).toMatchObject({
      feature: 'auth',
      method: 'Google',
      flow: 'sign_up',
    });
  });

  it('usePendingFeedbackQueue tracks feedback_prompt_shown once and only fires feedback_prompt_dismissed when unsubmitted items are skipped/closed', async () => {
    const pendingRes: Reservation = {
      id: 'res-501',
      myRole: 'mentee',
      viewerRole: 'MENTEE',
      mentor: {
        id: '777',
        name: '陳大華 Mentor Real Name',
        jobTitle: 'Staff Engineer',
      },
      mentee: {
        id: '9001',
        name: '王小明 Real Name',
        jobTitle: 'Junior Dev',
      },
      dtstart: 1700000000,
      dtend: 1700003600,
      status: 'ACCEPT',
    } as unknown as Reservation;

    mockFetchPendingFeedbackReservations.mockResolvedValue([pendingRes]);
    const coordinator = createFeedbackSessionCoordinator({
      storage: createMemoryStorage(),
    });

    const { result } = renderHook(() => usePendingFeedbackQueue(coordinator));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.queueItems).toHaveLength(1);
    const shownEvents = gtagCalls.filter(
      (c) => c[0] === 'event' && c[1] === 'feedback_prompt_shown'
    );
    expect(shownEvents).toHaveLength(1);
    expect(shownEvents[0]?.[2]).toMatchObject({
      feature: 'feedback',
      pending_count: 1,
    });

    act(() => {
      result.current.skipFeedbackItem(pendingRes);
      result.current.dismissQueue();
    });

    const dismissedEvents = gtagCalls.filter(
      (c) => c[0] === 'event' && c[1] === 'feedback_prompt_dismissed'
    );
    expect(dismissedEvents).toHaveLength(1);
    expect(dismissedEvents[0]?.[2]).toMatchObject({
      feature: 'feedback',
      skipped_count: 1,
    });
    expect(JSON.stringify(gtagCalls)).not.toContain('陳大華');
    expect(JSON.stringify(gtagCalls)).not.toContain('王小明');
    // Also verify submitting all items without skipping does NOT fire feedback_prompt_dismissed
    const coordinator2 = createFeedbackSessionCoordinator({
      storage: createMemoryStorage(),
    });
    mockFetchPendingFeedbackReservations.mockResolvedValue([pendingRes]);
    mockSubmitReservationFeedback.mockResolvedValue(undefined);
    const { result: result2 } = renderHook(() =>
      usePendingFeedbackQueue(coordinator2)
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    gtagCalls.length = 0;
    await act(async () => {
      await result2.current.submitFeedbackItem(
        {
          meeting_happened: true,
          feedback: { rating: 10, content: '很棒的對談' },
        },
        pendingRes
      );
      result2.current.dismissQueue();
    });
    expect(
      gtagCalls.filter(
        (c) => c[0] === 'event' && c[1] === 'feedback_prompt_dismissed'
      )
    ).toHaveLength(0);
    expect(JSON.stringify(gtagCalls)).not.toContain('很棒的對談');
  });

  it('upgrades Clarity session without emitting GA4 API error noise on Meet link fetch, schedule save, and avatar upload failures', async () => {
    const windowOpenSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({
        close: vi.fn(),
        location: { href: '' },
      } as unknown as Window);

    mockFetchReservationMeetLink.mockRejectedValue(new Error('404 not ready'));
    const { result: meetHook } = renderHook(() =>
      useReservationMeetLink({ myUserId: '9001' })
    );
    await act(async () => {
      await meetHook.current.joinMeet('res-501');
    });

    expect(clarityCalls).toContainEqual(['upgrade', 'meet_link_fetch_failed']);
    expect(gtagCalls).toHaveLength(0);

    mockUpdateAvatar.mockRejectedValue(
      new Error('S3 upload failed for 王小明_履歷照.jpg')
    );
    const { result: avatarHook } = renderHook(() =>
      useBackgroundAvatarUpload(9001)
    );
    const piiNamedFile = new File(['bytes'], '王小明_履歷照.jpg', {
      type: 'image/jpeg',
    });
    await act(async () => {
      avatarHook.current.kickOff(piiNamedFile, null);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clarityCalls).toContainEqual(['upgrade', 'avatar_upload_failed']);
    expect(JSON.stringify(clarityCalls)).not.toContain('王小明');
    expect(gtagCalls).toHaveLength(0);

    const mockReader: BookingCalendarReader = {
      year: 2026,
      month: 11,
      selectedDate: '2026-11-20',
      setSelectedDate: vi.fn(),
      allowedDates: ['2026-11-20'],
      slotsSnapshot: {
        monthLoaded: true,
        slots: [],
      } as unknown as BookingCalendarReader['slotsSnapshot'],
      isMonthSynced: true,
      isFetching: false,
      hasError: false,
      reload: vi.fn(),
      onMonthChange: vi.fn(),
      getDayBookingStatus: vi.fn().mockReturnValue(undefined),
    };
    const mockSchedule: MentorScheduleEditor = {
      slotsWithMeta: [],
      futureSlots: [],
      addSlotForSelectedDate: vi.fn(),
      deleteDraftSlot: vi.fn(),
      confirmChanges: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'conflict' }),
      resetChanges: vi.fn(),
      updateDraftSlot: vi.fn(),
    } as unknown as MentorScheduleEditor;

    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        reader={mockReader}
        schedule={mockSchedule}
      />
    );
    gtagCalls.length = 0;

    await act(async () => {
      screen.getByRole('button', { name: '儲存' }).click();
    });

    expect(clarityCalls).toContainEqual(['upgrade', 'schedule_save_failed']);
    expect(
      gtagCalls.find((c) => c[1] === 'reservation_schedule_saved')
    ).toBeUndefined();

    windowOpenSpy.mockRestore();
  });

  it('masks PII inside NotificationBell portal, WhoAreYou onboarding inputs, and AvatarCard with data-clarity-mask="true"', async () => {
    render(
      <NotificationBell
        userId="9001"
        initialStatus="success"
        initialNotifications={[
          {
            id: 'notif-1',
            type: 'reservation_requested',
            unread: true,
            createdAt: '2026-11-17T00:00:00Z',
            menteeName: '李小美 Secret Mentee',
            reservationId: '888',
          } as never,
        ]}
      />
    );

    await act(async () => {
      screen.getByRole('button', { name: '開啟通知選單' }).click();
    });

    const notifText = await screen.findByText(/李小美 Secret Mentee/);
    expect(notifText.closest('[data-clarity-mask="true"]')).not.toBeNull();

    function WhoAreYouHarness() {
      const form = useForm({
        defaultValues: {
          name: '王小明 Secret',
          avatar: '',
          avatarFile: undefined,
        },
      });
      return (
        <FormProvider {...form}>
          <WhoAreYou form={form} />
        </FormProvider>
      );
    }

    render(<WhoAreYouHarness />);
    const nameInput = screen.getByPlaceholderText('請填入您的姓名');
    expect(nameInput.closest('[data-clarity-mask="true"]')).not.toBeNull();

    render(
      <AvatarCard
        name="張三豐 Real Mentor"
        jobTitle="Principal Architect"
        companyName="Acme"
      />
    );
    const cardHeading = screen.getByRole('heading', {
      name: '張三豐 Real Mentor',
    });
    expect(cardHeading.closest('[data-clarity-mask="true"]')).not.toBeNull();
  });
});
