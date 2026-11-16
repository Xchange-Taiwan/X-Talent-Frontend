import type { Meta, StoryObj } from '@storybook/nextjs';

import { FeedbackRadioOption } from './FeedbackRadioOption';

const meta: Meta<typeof FeedbackRadioOption> = {
  title: '業務模組元件/預約管理(Reservation)/FeedbackRadioOption',
  component: FeedbackRadioOption,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof FeedbackRadioOption>;

export const Unselected: Story = {
  args: {
    name: 'demo-radio',
    label: '有進行',
    checked: false,
    onSelect: () => {},
  },
};

export const Selected: Story = {
  args: {
    name: 'demo-radio',
    label: '有進行',
    checked: true,
    onSelect: () => {},
  },
};
