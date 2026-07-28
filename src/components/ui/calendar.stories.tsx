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

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <div className="w-fit rounded-lg border bg-card p-4 shadow">
        <Calendar {...args} mode="single" selected={date} onSelect={setDate} />
        {date && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            您選取的日期是: {date.toLocaleDateString()}
          </p>
        )}
      </div>
    );
  },
};

// 2. Profile Variant
export const ProfileVariant: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <div className="w-fit rounded-lg border bg-card p-4 shadow">
        <Calendar
          {...args}
          variant="profile"
          mode="single"
          selected={date}
          onSelect={setDate}
        />
      </div>
    );
  },
};
