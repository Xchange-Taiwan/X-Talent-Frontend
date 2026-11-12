import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMeetingFeedbackForm } from '@/hooks/user/reservation/useMeetingFeedbackForm';

import {
  AttendanceStepContent,
  NotHappenedStepContent,
  RatingStepContent,
} from './MeetingFeedbackSteps';

function AttendancePreview() {
  const [val, setVal] = React.useState<boolean | null>(true);
  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <AttendanceStepContent
          meetingHappened={val}
          onSelectMeetingHappened={setVal}
        />
      </DialogContent>
    </Dialog>
  );
}

function NotHappenedPreview() {
  const form = useMeetingFeedbackForm();
  const party = form.watch('notHappenedParty');
  const reason = form.watch('notHappenedReason');
  const note = form.watch('notHappenedNote');

  return (
    <Dialog open>
      <DialogContent className="max-w-[468px] space-y-4">
        <NotHappenedStepContent
          notHappenedParty={party}
          notHappenedReason={reason}
          notHappenedNote={note}
          noteFieldId="story-note"
          isSubmitting={false}
          noteRegistration={form.register('notHappenedNote')}
          onSelectParty={(next) => form.setValue('notHappenedParty', next)}
          onSelectReason={(next) => form.setValue('notHappenedReason', next)}
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
          portalContainer={null}
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
