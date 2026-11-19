import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';

import { MentorGuidelinesCard } from './MentorGuidelinesCard';

const meta: Meta<typeof MentorGuidelinesCard> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/MentorGuidelinesCard',
  component: MentorGuidelinesCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorGuidelinesCard>;

export const DefaultCollapsed: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="max-w-[720px] p-4">
        <MentorGuidelinesCard
          checked={checked}
          onCheckedChange={setChecked}
          defaultExpanded={false}
        />
      </div>
    );
  },
};

export const ExpandedAndChecked: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    return (
      <div className="max-w-[720px] p-4">
        <MentorGuidelinesCard
          checked={checked}
          onCheckedChange={setChecked}
          defaultExpanded={true}
        />
      </div>
    );
  },
};
