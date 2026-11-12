import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import AuthCard from '@/components/auth/AuthCard';
import * as authCardStories from '@/components/auth/AuthCard.stories';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import * as authMessageCardStories from '@/components/auth/AuthMessageCard.stories';
import { FeatureItem } from '@/components/landing/FeatureItem';
import * as featureItemStories from '@/components/landing/FeatureItem.stories';
import * as homePageCtaButtonStories from '@/components/landing/HomePageCtaButton.stories';
import * as announcementBannerStories from '@/components/layout/AnnouncementBanner/AnnouncementBanner.stories';
import { GuestActionButtons } from '@/components/layout/Header/GuestActionButtons';
import * as guestActionButtonsStories from '@/components/layout/Header/GuestActionButtons.stories';
import * as notificationBellStories from '@/components/layout/Header/NotificationBell.stories';
import { UserAvatar } from '@/components/layout/Header/UserAvatar';
import * as userAvatarStories from '@/components/layout/Header/UserAvatar.stories';
import * as mentorCardStories from '@/components/mentor-pool/mentor-card/index.stories';
import { Information } from '@/components/mentor-pool/mentor-card/Information';
import * as informationStories from '@/components/mentor-pool/mentor-card/Information.stories';
import * as confirmedReservationDialogStories from '@/components/profile/reservation/ConfirmedReservationDialog.stories';
import * as menteeBookingFormStories from '@/components/profile/reservation/MenteeBookingForm.stories';
import * as quickReplyDialogStories from '@/components/profile/reservation/QuickReplyDialog.stories';
import { FeedbackStarRating } from '@/components/reservation/FeedbackStarRating';
import * as feedbackStarRatingStories from '@/components/reservation/FeedbackStarRating.stories';
import { JoinMeetButton } from '@/components/reservation/JoinMeetButton';
import * as joinMeetButtonStories from '@/components/reservation/JoinMeetButton.stories';
import * as feedbackRadioOptionStories from '@/components/reservation/meeting-feedback/FeedbackRadioOption.stories';
import * as meetingFeedbackStepsStories from '@/components/reservation/meeting-feedback/MeetingFeedbackSteps.stories';
import * as meetingFeedbackDialogStories from '@/components/reservation/MeetingFeedbackDialog.stories';
import { ReplyMessageField } from '@/components/reservation/ReplyMessageField';
import * as replyMessageFieldStories from '@/components/reservation/ReplyMessageField.stories';
import * as reservationCardStories from '@/components/reservation/ReservationCard.stories';
import * as reservationConversationDialogStories from '@/components/reservation/ReservationConversationDialog.stories';
import * as reservationDashboardStories from '@/components/reservation/ReservationDashboard.stories';
import { ReservationFeedbackBlock } from '@/components/reservation/ReservationFeedbackBlock';
import * as reservationFeedbackBlockStories from '@/components/reservation/ReservationFeedbackBlock.stories';
import * as reservationListStories from '@/components/reservation/ReservationList.stories';
import * as reservationMessagePreviewStories from '@/components/reservation/ReservationMessagePreview.stories';
import * as sliderStories from '@/components/ui/slider.stories';
import * as tooltipStories from '@/components/ui/tooltip.stories';

describe('Storybook stories coverage for recent commits (#849)', () => {
  it('exposes all identity states for HomePageCtaButton and FeatureItem stories (#709)', () => {
    expect(homePageCtaButtonStories.default.title).toBe(
      '業務模組元件/首頁(Landing)/HomePageCtaButton'
    );
    expect(homePageCtaButtonStories.GuestState).toBeDefined();
    expect(homePageCtaButtonStories.MenteeState).toBeDefined();
    expect(homePageCtaButtonStories.MentorState).toBeDefined();
    expect(homePageCtaButtonStories.LoadingSkeleton).toBeDefined();

    expect(featureItemStories.default.title).toBe(
      '業務模組元件/首頁(Landing)/FeatureItem'
    );
    expect(featureItemStories.Default).toBeDefined();
    expect(featureItemStories.AllFeaturesGrid).toBeDefined();

    const defaultArgs = featureItemStories.default.args!;
    render(
      <FeatureItem
        icon={defaultArgs.icon!}
        width={defaultArgs.width!}
        height={defaultArgs.height!}
        text={defaultArgs.text!}
      />
    );
    expect(screen.getByText(defaultArgs.text!)).toBeInTheDocument();
  });

  it('exposes and renders AuthCard and AuthMessageCard stories (#805)', () => {
    expect(authCardStories.default.title).toBe(
      '業務模組元件/會員驗證(Auth)/AuthCard'
    );
    expect(authCardStories.DefaultWithoutBanner.args?.showBanner).toBe(false);
    expect(authCardStories.WithTopIconBanner.args?.showBanner).toBe(true);
    expect(authCardStories.CustomWidthAndSpacing).toBeDefined();

    render(
      <AuthCard {...authCardStories.WithTopIconBanner.args}>
        {authCardStories.WithTopIconBanner.args?.children}
      </AuthCard>
    );
    expect(screen.getByText('驗證信箱')).toBeInTheDocument();

    expect(authMessageCardStories.default.title).toBe(
      '業務模組元件/會員驗證(Auth)/AuthMessageCard'
    );
    expect(authMessageCardStories.Default).toBeDefined();
    expect(authMessageCardStories.EmailNotificationSent).toBeDefined();
    expect(authMessageCardStories.VerificationSuccess).toBeDefined();
    expect(authMessageCardStories.VerificationFailedOrExpired).toBeDefined();

    const failedArgs = authMessageCardStories.VerificationFailedOrExpired.args!;
    render(
      <AuthMessageCard
        icon={failedArgs.icon!}
        iconAlt={failedArgs.iconAlt}
        title={failedArgs.title!}
      >
        {failedArgs.children}
      </AuthMessageCard>
    );
    expect(screen.getByText('驗證失敗')).toBeInTheDocument();
  });

  it('exposes role and variant empty-state stories on ReservationList (#806)', () => {
    expect(reservationListStories.EmptyUpcomingMentee.args).toMatchObject({
      items: [],
      variant: 'upcoming',
      sourceRole: 'mentee',
    });
    expect(reservationListStories.EmptyPendingMentee.args).toMatchObject({
      items: [],
      variant: 'pending-mentee',
      sourceRole: 'mentee',
    });
    expect(reservationListStories.EmptyHistoryMentee.args).toMatchObject({
      items: [],
      variant: 'history',
      sourceRole: 'mentee',
    });
    expect(reservationListStories.EmptyUpcomingMentor.args).toMatchObject({
      items: [],
      variant: 'upcoming',
      sourceRole: 'mentor',
    });
    expect(reservationListStories.EmptyPendingMentor.args).toMatchObject({
      items: [],
      variant: 'pending-mentor',
      sourceRole: 'mentor',
    });
    expect(reservationListStories.EmptyHistoryMentor.args).toMatchObject({
      items: [],
      variant: 'history',
      sourceRole: 'mentor',
    });
  });

  it('exposes and renders system auto-cancelled and reservation subcomponent stories (#781, #822)', () => {
    expect(
      reservationCardStories.SystemAutoCancelled.args?.item?.cancelledBy
    ).toBe('SYSTEM');
    expect(reservationCardStories.HistoryCompleted.args?.variant).toBe(
      'history'
    );
    expect(
      reservationConversationDialogStories.SystemAutoCancelled.args?.reservation
        ?.cancelledBy
    ).toBe('SYSTEM');

    expect(confirmedReservationDialogStories.Default).toBeDefined();
    expect(quickReplyDialogStories.Default).toBeDefined();
    expect(joinMeetButtonStories.Default).toBeDefined();
    expect(joinMeetButtonStories.MentorReservationCard.args).toMatchObject({
      sourceRole: 'mentor',
      analyticsLocation: 'reservation_card',
    });
    expect(joinMeetButtonStories.MenteeConfirmedDialog.args).toMatchObject({
      sourceRole: 'mentee',
      analyticsLocation: 'confirmed_reservation_dialog',
    });
    expect(joinMeetButtonStories.PendingState.args?.isPending).toBe(true);

    render(
      <JoinMeetButton
        onClick={() => {}}
        isPending={Boolean(joinMeetButtonStories.PendingState.args?.isPending)}
      />
    );
    expect(screen.getByText('載入中...')).toBeInTheDocument();

    expect(replyMessageFieldStories.Collapsed).toBeDefined();
    expect(replyMessageFieldStories.Expanded.args?.open).toBe(true);
    render(
      <ReplyMessageField
        open={true}
        onOpen={() => {}}
        error={replyMessageFieldStories.WithValidationError.args?.error}
        textareaProps={{}}
      />
    );
    expect(screen.getByText('回覆訊息不可超過 500 字')).toBeInTheDocument();

    expect(
      reservationMessagePreviewStories.CardVariantWithBothMessages
    ).toBeDefined();
    expect(
      reservationMessagePreviewStories.DialogVariantWithBothMessages
    ).toBeDefined();
    expect(reservationMessagePreviewStories.CancelledWithReason).toBeDefined();
    expect(
      reservationConversationDialogStories.CancelledWithReason
    ).toBeDefined();
    expect(
      reservationDashboardStories.HistoryLoadingWithPreservedCounts
    ).toBeDefined();
    expect(reservationListStories.CancelledHistoryWithReason).toBeDefined();
  });

  it('exposes and renders MenteeBookingForm, NotificationBell, Header, and Slider stories (#712, #823, #804, #807)', () => {
    expect(
      menteeBookingFormStories.UnauthenticatedSignInPrompt.args?.isAuthenticated
    ).toBe(false);
    expect(menteeBookingFormStories.NoAvailableSlots.args?.slots).toEqual([]);

    expect(
      notificationBellStories.UpcomingReservationWithDtstart.args
        ?.initialNotifications?.[0]
    ).toMatchObject({
      type: 'reservation_upcoming',
      dtstart: 1785931200,
    });
    expect(
      notificationBellStories.CanceledReservationByRole.args
        ?.initialNotifications
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'reservation_canceled',
          role: 'mentor',
        }),
        expect.objectContaining({
          type: 'reservation_canceled',
          role: 'mentee',
        }),
      ])
    );

    expect(announcementBannerStories.ActiveMaintenanceNotice).toBeDefined();
    expect(guestActionButtonsStories.ConfirmedGuest).toBeDefined();
    render(
      <GuestActionButtons
        identity={guestActionButtonsStories.ConfirmedGuest.args!.identity!}
      />
    );
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();

    expect(userAvatarStories.DefaultFallback).toBeDefined();
    render(
      <UserAvatar
        src={userAvatarStories.DefaultFallback.args?.src}
        name={userAvatarStories.DefaultFallback.args?.name}
        size={userAvatarStories.DefaultFallback.args?.size ?? 40}
      />
    );
    expect(screen.getByAltText('林學員 (Mentee) 的頭像')).toBeInTheDocument();

    expect(sliderStories.Default).toBeDefined();
  });

  it('exposes and renders MentorCard and Information Option B rating stories (#737)', () => {
    expect(mentorCardStories.default.title).toBe(
      '業務模組元件/導師池(MentorPool)/MentorCard'
    );
    expect(mentorCardStories.Default.args?.ratingAverage).toBe(9.8);
    expect(mentorCardStories.Default.args?.completedMeetingCount).toBe(18);
    expect(
      mentorCardStories.StaffProductManager.args?.ratingAverage
    ).toBeNull();
    expect(
      mentorCardStories.StaffProductManager.args?.completedMeetingCount
    ).toBe(5);
    expect(
      mentorCardStories.NoRatingsOrSessions.args?.ratingAverage
    ).toBeNull();
    expect(
      mentorCardStories.NoRatingsOrSessions.args?.completedMeetingCount
    ).toBe(0);
    expect(mentorCardStories.LongNameWithRating).toBeDefined();

    expect(informationStories.default.title).toBe(
      '業務模組元件/導師池(MentorPool)/Information'
    );
    expect(informationStories.CompletedSessionsWithoutRating).toBeDefined();
    expect(informationStories.NoRatingsAndNoSessions).toBeDefined();
    expect(informationStories.MobileLongNameTruncation).toBeDefined();

    const defaultInfoArgs = informationStories.Default.args!;
    render(
      <Information
        name={defaultInfoArgs.name!}
        job_title={defaultInfoArgs.job_title!}
        company={defaultInfoArgs.company!}
        about={defaultInfoArgs.about!}
        haveTopicLabels={defaultInfoArgs.haveTopicLabels!}
        ratingAverage={defaultInfoArgs.ratingAverage}
        completedMeetingCount={defaultInfoArgs.completedMeetingCount}
      />
    );
    expect(screen.getByText('9.8 / 10')).toBeInTheDocument();
    expect(screen.getByText('已完成 18 場 1-on-1')).toBeInTheDocument();
  });

  it('exposes and renders MeetingFeedbackDialog and ReservationFeedbackBlock stories (#730)', () => {
    expect(feedbackStarRatingStories.default.title).toBe(
      '業務模組元件/預約管理(Reservation)/FeedbackStarRating'
    );
    expect(feedbackStarRatingStories.DefaultFullScore).toBeDefined();
    expect(feedbackStarRatingStories.PartialScoreEight).toBeDefined();
    expect(feedbackStarRatingStories.DisabledState).toBeDefined();

    render(
      <FeedbackStarRating
        value={feedbackStarRatingStories.DefaultFullScore.args!.value!}
        onChange={() => {}}
      />
    );
    expect(
      screen.getByRole('radiogroup', { name: '整體滿意度' })
    ).toBeInTheDocument();

    expect(meetingFeedbackDialogStories.default.title).toBe(
      '業務模組元件/預約管理(Reservation)/MeetingFeedbackDialog'
    );
    expect(meetingFeedbackDialogStories.ClosedTrigger).toBeDefined();
    expect(meetingFeedbackDialogStories.StepAttendanceOpen).toBeDefined();
    expect(meetingFeedbackDialogStories.StepRatingStarsOpen).toBeDefined();
    expect(meetingFeedbackDialogStories.StepRatingSliderOpen).toBeDefined();
    expect(meetingFeedbackDialogStories.StepNotHappenedOpen).toBeDefined();
    expect(meetingFeedbackDialogStories.MultiSessionQueueOpen).toBeDefined();
    expect(meetingFeedbackDialogStories.EditTriggerClosed).toBeDefined();
    expect(meetingFeedbackDialogStories.EditModePrefilledOpen).toBeDefined();

    expect(reservationFeedbackBlockStories.default.title).toBe(
      '業務模組元件/預約管理(Reservation)/ReservationFeedbackBlock'
    );
    expect(reservationFeedbackBlockStories.MenteePublicRating).toBeDefined();
    expect(
      reservationFeedbackBlockStories.MenteeEmptyCommentFallback
    ).toBeDefined();
    expect(reservationFeedbackBlockStories.MentorPublicRating).toBeDefined();
    expect(
      reservationFeedbackBlockStories.MenteeUnpublicizedRating
    ).toBeDefined();
    expect(
      reservationFeedbackBlockStories.CollapsibleUnpublicizedToggleDemo
    ).toBeDefined();

    expect(reservationCardStories.HistoryMenteeNeedsFeedback).toBeDefined();
    expect(reservationCardStories.HistoryMenteeRatedPublic).toBeDefined();
    expect(reservationCardStories.HistoryMenteeRatedUnpublicized).toBeDefined();
    expect(reservationCardStories.HistoryMenteeNotHappened).toBeDefined();
    expect(reservationListStories.MenteeHistoryFeedbackStates).toBeDefined();
    expect(tooltipStories.DefaultHover).toBeDefined();
    expect(tooltipStories.ClickToPin).toBeDefined();
    expect(feedbackRadioOptionStories.Unselected).toBeDefined();
    expect(feedbackRadioOptionStories.Selected).toBeDefined();
    expect(meetingFeedbackStepsStories.Step1Attendance).toBeDefined();
    expect(meetingFeedbackStepsStories.Step2Rating).toBeDefined();
    expect(meetingFeedbackStepsStories.Step2NotHappened).toBeDefined();
    expect(
      meetingFeedbackStepsStories.Step2NotHappenedOtherExpanded
    ).toBeDefined();

    render(
      <ReservationFeedbackBlock
        model={
          reservationFeedbackBlockStories.MenteeUnpublicizedRating.args!.model!
        }
      />
    );
    expect(
      screen.getByTestId('reservation-feedback-unpublicized')
    ).toBeInTheDocument();
  });
});
