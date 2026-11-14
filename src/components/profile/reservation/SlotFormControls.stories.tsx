import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import type { SlotDurationMinutes } from '@/lib/profile/bookingAvailability';

import { DurationRadio, TimeSelectPair } from './SlotFormControls';

function SlotFormControlsDemo() {
  const [hour, setHour] = useState('14');
  const [minute, setMinute] = useState('30');
  const [duration, setDuration] = useState<SlotDurationMinutes>(45);

  return (
    <div className="bg-background-white flex max-w-[380px] flex-col gap-5 rounded-lg border p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">開始時間</p>
        <TimeSelectPair
          hourValue={hour}
          minuteValue={minute}
          onHourChange={setHour}
          onMinuteChange={setMinute}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">會議長度</p>
        <DurationRadio value={duration} onChange={setDuration} />
      </div>
    </div>
  );
}

const meta: Meta<typeof SlotFormControlsDemo> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/SlotFormControls',
  component: SlotFormControlsDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SlotFormControlsDemo>;

export const Default: Story = {};
