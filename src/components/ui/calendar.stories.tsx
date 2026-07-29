import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { Calendar } from './calendar';

const meta: Meta<typeof Calendar> = {
  title: 'Components/UI/Calendar',
  component: Calendar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Calendar>;

const CalendarDemo = (args: React.ComponentProps<typeof Calendar>) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <div className="w-fit rounded-lg border bg-background-white p-4 shadow">
      <Calendar {...args} mode="single" selected={date} onSelect={setDate} />
      {date && (
        <p className="mt-4 text-center text-sm text-text-tertiary">
          您選取的日期是: {date.toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

const CalendarProfileDemo = (args: React.ComponentProps<typeof Calendar>) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <div className="w-fit rounded-lg border bg-background-white p-4 shadow">
      <Calendar
        {...args}
        variant="profile"
        mode="single"
        selected={date}
        onSelect={setDate}
      />
    </div>
  );
};

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => <CalendarDemo {...args} />,
};

// 2. Profile Variant
export const ProfileVariant: Story = {
  render: (args) => <CalendarProfileDemo {...args} />,
};
