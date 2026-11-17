import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from '@/hooks/user/reservation/useMeetingFeedbackForm';
import { resolveMeetingFeedbackFooterModel } from '@/schemas/meetingFeedbackSchema';
import type { NotHappenedReason } from '@/types/reservationFeedback';

import {
  AttendanceStepContent,
  MeetingFeedbackFooter,
  MentorNotHappenedWarning,
  NotHappenedStepContent,
  RatingStepContent,
} from './MeetingFeedbackSteps';

function AttendancePreview({
  initialValue = true,
  isMentor = false,
}: {
  initialValue?: boolean | null;
  isMentor?: boolean;
}) {
  const [val, setVal] = React.useState<boolean | null>(initialValue);
  const footerModel = resolveMeetingFeedbackFooterModel({
    step: 'attendance',
    role: isMentor ? 'mentor' : 'mentee',
    values: { meetingHappened: val },
  });

  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <AttendanceStepContent
          meetingHappened={val}
          onSelectMeetingHappened={setVal}
        />
        <MeetingFeedbackFooter
          footerModel={footerModel}
          onNextFromAttendance={() => {}}
          onBackToAttendance={() => {}}
          onCancelEdit={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}

function NotHappenedPreview({
  initialReason = null,
  initialNote = '',
  isMentor = false,
}: {
  initialReason?: NotHappenedReason | null;
  initialNote?: string;
  isMentor?: boolean;
}) {
  const role = isMentor ? 'mentor' : 'mentee';
  const form = useMeetingFeedbackForm(
    {
      ...DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
      meetingHappened: false,
      notHappenedReason: initialReason,
      notHappenedNote: initialNote,
    },
    role
  );
  const reason = form.watch('notHappenedReason');
  const note = form.watch('notHappenedNote');
  const footerModel = resolveMeetingFeedbackFooterModel({
    step: 'not-happened',
    role,
    values: {
      meetingHappened: false,
      notHappenedReason: reason,
      notHappenedNote: note,
    },
  });

  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-3">
        <NotHappenedStepContent
          isMentor={isMentor}
          notHappenedReason={reason}
          notHappenedNote={note}
          noteFieldId="story-note"
          isSubmitting={false}
          noteRegistration={form.register('notHappenedNote')}
          onSelectReason={(next) => form.setValue('notHappenedReason', next)}
        />
        {isMentor ? <MentorNotHappenedWarning /> : null}
        <MeetingFeedbackFooter
          footerModel={footerModel}
          onNextFromAttendance={() => {}}
          onBackToAttendance={() => {}}
          onCancelEdit={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}

function RatingPreview({
  isEditMode = false,
  hasRemainingQueueCard = false,
}: {
  isEditMode?: boolean;
  hasRemainingQueueCard?: boolean;
}) {
  const form = useMeetingFeedbackForm({
    ...DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
    meetingHappened: true,
    rating: isEditMode ? 8 : 10,
    content: isEditMode ? '導師提供了非常具體的職涯建議。' : '',
  });
  const rating = form.watch('rating');
  const content = form.watch('content');
  const footerModel = resolveMeetingFeedbackFooterModel({
    step: 'rating',
    mode: isEditMode ? 'edit' : 'create',
    role: 'mentee',
    hasRemainingQueueCard,
    values: {
      meetingHappened: true,
      rating,
      content,
    },
  });

  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <RatingStepContent
          isEditMode={isEditMode}
          rating={rating}
          content={content}
          contentFieldId="story-content"
          isSubmitting={false}
          contentRegistration={form.register('content')}
          tooltipDismissSignal={0}
          onMaskTooltipOpenChange={() => {}}
          onRatingChange={(next) => form.setValue('rating', next)}
        />
        <MeetingFeedbackFooter
          footerModel={footerModel}
          onNextFromAttendance={() => {}}
          onBackToAttendance={() => {}}
          onCancelEdit={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}

const meta: Meta<typeof AttendanceStepContent> = {
  title: '業務模組元件/預約管理(Reservation)/MeetingFeedbackSteps',
  component: AttendanceStepContent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AttendanceStepContent>;

export const Step1Attendance: Story = {
  render: () => <AttendancePreview />,
};

export const Step2Rating: Story = {
  render: () => <RatingPreview />,
};

export const Step2RatingQueueNextSession: Story = {
  render: () => <RatingPreview hasRemainingQueueCard />,
};

export const EditModeRating: Story = {
  render: () => <RatingPreview isEditMode />,
};

export const Step2NotHappened: Story = {
  render: () => <NotHappenedPreview />,
};

export const Step2NotHappenedOtherExpanded: Story = {
  render: () => <NotHappenedPreview initialReason="OTHER" />,
};

export const MentorStep1Unselected: Story = {
  render: () => <AttendancePreview initialValue={null} isMentor />,
};

export const MentorStep1Happened: Story = {
  render: () => <AttendancePreview initialValue={true} isMentor />,
};

export const MentorStep1NotHappened: Story = {
  render: () => <AttendancePreview initialValue={false} isMentor />,
};

export const MentorStep2NotHappenedWithWarning: Story = {
  render: () => (
    <NotHappenedPreview initialReason="COUNTERPART_ABSENT" isMentor />
  ),
};

export const MentorStep2NotHappenedOtherExpanded: Story = {
  render: () => (
    <NotHappenedPreview
      initialReason="OTHER"
      initialNote="學員臨時有事已在聊聊通知改期"
      isMentor
    />
  ),
};
