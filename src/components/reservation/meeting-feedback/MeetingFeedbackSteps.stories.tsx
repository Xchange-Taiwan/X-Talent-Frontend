import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from '@/hooks/user/reservation/useMeetingFeedbackForm';
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
  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <AttendanceStepContent
          meetingHappened={val}
          onSelectMeetingHappened={setVal}
        />
        <MeetingFeedbackFooter
          effectiveStep="attendance"
          isEditMode={false}
          isMentor={isMentor}
          meetingHappened={val}
          isSubmitting={false}
          isTransitioningCard={false}
          canProceedAttendance={val !== null}
          canSubmitStep2={false}
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
  isMentor = false,
}: {
  initialReason?: NotHappenedReason | null;
  isMentor?: boolean;
}) {
  const form = useMeetingFeedbackForm(
    {
      ...DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
      meetingHappened: false,
      notHappenedReason: initialReason,
    },
    isMentor ? 'mentor' : 'mentee'
  );
  const reason = form.watch('notHappenedReason');
  const note = form.watch('notHappenedNote');

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
          effectiveStep="not-happened"
          isEditMode={false}
          isMentor={isMentor}
          meetingHappened={false}
          isSubmitting={false}
          isTransitioningCard={false}
          canProceedAttendance={true}
          canSubmitStep2={reason !== null}
          onNextFromAttendance={() => {}}
          onBackToAttendance={() => {}}
          onCancelEdit={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}

function RatingPreview() {
  const form = useMeetingFeedbackForm();
  const rating = form.watch('rating');
  const content = form.watch('content');

  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <RatingStepContent
          isEditMode={false}
          rating={rating}
          content={content}
          contentFieldId="story-content"
          isSubmitting={false}
          contentRegistration={form.register('content')}
          tooltipDismissSignal={0}
          onMaskTooltipOpenChange={() => {}}
          onRatingChange={(next) => form.setValue('rating', next)}
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
  render: () => <NotHappenedPreview initialReason="MENTEE_ABSENT" isMentor />,
};

export const MentorStep2NotHappenedOtherExpanded: Story = {
  render: () => <NotHappenedPreview initialReason="OTHER" isMentor />,
};
