import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    clearAnalyticsUser: vi.fn(),
    trackEvent: vi.fn(),
  };
});

import * as EmailVerifiedStories from '@/app/auth/email-verified/ui.stories';
import * as EmailVerifyStories from '@/app/auth/email-verify/ui.stories';
import * as MentorGridSkeletonStories from '@/app/mentor-pool/MentorGridSkeleton.stories';
import * as PopularPositionChipsStories from '@/app/mentor-pool/PopularPositionChips.stories';
import * as MentorPoolUIStories from '@/app/mentor-pool/ui.stories';
import * as ProfilePageUIStories from '@/app/profile/[pageUserId]/ui.stories';
import * as ProfileCardUIStories from '@/app/profile/card/ui.stories';
import * as AnalyticsUserSyncStories from '@/components/AnalyticsUserSync.stories';
import * as SignUpFormStories from '@/components/auth/signup/SignUpForm.stories';
import * as HeaderStories from '@/components/layout/Header/Header.stories';
import { decodeSessionHint } from '@/lib/auth/sessionHint';

import * as AddSlotModalStories from './AddSlotModal.stories';
import * as BookingFormStories from './BookingForm.stories';
import * as EditSlotModalStories from './EditSlotModal.stories';
import MentorScheduleDialog from './MentorScheduleDialog';
import * as MentorScheduleDialogStories from './MentorScheduleDialog.stories';
import * as ReservationBlockPromptDialogStories from './ReservationBlockPromptDialog.stories';
import * as ScheduleCalendarStories from './ScheduleCalendar.stories';
import * as SlotFormControlsStories from './SlotFormControls.stories';

describe('Storybook stories coverage and state verification (#850)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
  });

  it('MentorScheduleDialog.stories uses dynamic future dates, negative virtual IDs, and renders BOOKED/PENDING mentee prompts', () => {
    const nowMs = Date.now();
    const defaultDraftSlots =
      MentorScheduleDialogStories.Default.args?.schedule
        ?.draftForSelectedDate ?? [];
    const virtualSlots = defaultDraftSlots.filter(
      (s) => s.type === 'BOOKED' || s.type === 'PENDING'
    );
    expect(virtualSlots.length).toBeGreaterThanOrEqual(2);
    for (const slot of virtualSlots) {
      expect(slot.id).toBeLessThan(0);
      expect(slot.start.getTime()).toBeGreaterThan(nowMs);
    }

    const args = MentorScheduleDialogStories.WithBookedAndPendingPrompts.args!;
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        reader={args.reader!}
        schedule={args.schedule!}
      />
    );

    const bookedSlot = screen
      .getByText('15:00 – 15:30')
      .closest('[role="button"]');
    expect(bookedSlot).toBeInTheDocument();
    fireEvent.click(bookedSlot!);
    expect(
      screen.getByRole('dialog', { name: '學員 王小明 已預約此時段' })
    ).toBeInTheDocument();
  });

  it('MentorScheduleDialog.stories OrphanVirtualReservationSlot renders orphan BOOKED and PENDING slots after ALLOW deletion', () => {
    const args = MentorScheduleDialogStories.OrphanVirtualReservationSlot.args!;
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        reader={args.reader!}
        schedule={args.schedule!}
      />
    );

    expect(screen.getByText('14:00 – 14:30')).toBeInTheDocument();
    const pendingOrphanSlot = screen
      .getByText('16:00 – 16:45')
      .closest('[role="button"]');
    expect(pendingOrphanSlot).toBeInTheDocument();
    fireEvent.click(pendingOrphanSlot!);
    expect(
      screen.getByRole('dialog', { name: '學員 陳怡君 申請預約此時段' })
    ).toBeInTheDocument();
  });

  it('ScheduleCalendar.stories exports ControlledMonthCursor with month distinct from selected date', () => {
    const args = ScheduleCalendarStories.ControlledMonthCursor.args!;
    expect(args.selected).toBeInstanceOf(Date);
    expect(args.month).toBeInstanceOf(Date);
    expect((args.month as Date).getMonth()).not.toBe(
      (args.selected as Date).getMonth()
    );
  });

  it('BookingForm.stories exports UnauthenticatedVisitorView and NoAvailableSlotsView', () => {
    expect(
      BookingFormStories.UnauthenticatedVisitorView.args?.isAuthenticated
    ).toBe(false);
    expect(
      BookingFormStories.NoAvailableSlotsView.args?.slotsSnapshot?.slots
    ).toEqual([]);
  });

  it('ProfilePageUI, MentorPoolUI, PopularPositionChips, MentorGridSkeleton, ProfileCardUI, and EmailVerify stories export expected states', () => {
    expect(
      ProfilePageUIStories.MentorOwnerView.args?.canShowOwnerControls
    ).toBe(true);
    expect(
      ProfilePageUIStories.MentorVisitorView.args?.canShowOwnerControls
    ).toBe(false);
    expect(
      ProfilePageUIStories.MenteeProfileView.args?.userData?.is_mentor
    ).toBe(false);
    expect(ProfilePageUIStories.LoadingSkeleton.args?.userLoading).toBe(true);

    expect(MentorPoolUIStories.DefaultSuccess.args?.listStatus).toBe('success');
    expect(
      MentorPoolUIStories.WithActiveFilterBadges.args?.activeFilterBadges
    ).toHaveLength(2);
    expect(MentorPoolUIStories.ReplacingOverlay.args?.isReplacing).toBe(true);
    expect(MentorPoolUIStories.LoadingState.args?.listStatus).toBe('loading');
    expect(MentorPoolUIStories.EmptyNoResults.args?.listStatus).toBe('empty');
    expect(MentorPoolUIStories.ErrorRetryState.args?.listStatus).toBe('error');

    expect(PopularPositionChipsStories.DesktopTrimmed).toBeDefined();
    expect(PopularPositionChipsStories.NarrowHorizontalScroll).toBeDefined();
    expect(MentorGridSkeletonStories.Default).toBeDefined();

    expect(ProfileCardUIStories.MenteeCompletedView.args?.isMentor).toBe(false);
    expect(ProfileCardUIStories.MentorCompletedView.args?.isMentor).toBe(true);

    expect(EmailVerifyStories.PendingVerification.args).toBeDefined();
    expect(EmailVerifiedStories.VerificationSuccess.args?.title).toBe(
      '驗證成功'
    );
    expect(EmailVerifiedStories.VerificationExpiredOrFailed.args?.title).toBe(
      '驗證失敗'
    );

    expect(SignUpFormStories.EmptySubmitValidationError).toBeDefined();
    expect(AnalyticsUserSyncStories.AuthenticatedMentee).toBeDefined();
    expect(AnalyticsUserSyncStories.AuthenticatedMentor).toBeDefined();
    expect(AnalyticsUserSyncStories.UnauthenticatedGuest).toBeDefined();
  });

  it('Header.stories uses v2 encoded sessionHint with avatar and isMentor', () => {
    const mentorHintRaw =
      HeaderStories.ResolvingMentorV2HintState.parameters?.auth?.sessionHint;
    const menteeHintRaw =
      HeaderStories.ResolvingUserState.parameters?.auth?.sessionHint;

    const decodedMentor = decodeSessionHint(mentorHintRaw);
    const decodedMentee = decodeSessionHint(menteeHintRaw);

    expect(decodedMentor).toEqual(
      expect.objectContaining({
        isMentor: true,
        userId: 'mentor-123',
        avatar: expect.stringContaining('https://'),
      })
    );
    expect(decodedMentee).toEqual(
      expect.objectContaining({
        isMentor: false,
        userId: 'mentee-456',
        avatar: expect.stringContaining('https://'),
      })
    );
  });

  it('provides required slotsWithMeta/futureSlots on MentorScheduleDialog stories and exposes extracted sub-modal stories (#880)', () => {
    const defaultSchedule = MentorScheduleDialogStories.Default.args?.schedule;
    expect(defaultSchedule?.slotsWithMeta.length).toBeGreaterThanOrEqual(4);
    expect(defaultSchedule?.futureSlots.length).toBeGreaterThanOrEqual(3);

    expect(AddSlotModalStories.DefaultEmptyDay).toBeDefined();
    expect(AddSlotModalStories.AfterExistingSlots).toBeDefined();
    expect(EditSlotModalStories.Default).toBeDefined();
    expect(
      ReservationBlockPromptDialogStories.BookedWithMenteeName
    ).toBeDefined();
    expect(
      ReservationBlockPromptDialogStories.PendingWithMenteeName
    ).toBeDefined();
    expect(SlotFormControlsStories.Default).toBeDefined();
  });
});
