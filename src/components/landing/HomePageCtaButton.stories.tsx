import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  HomePageCtaButton,
  type HomePageCtaButtonProps,
} from './HomePageCtaButton';

const meta: Meta<typeof HomePageCtaButton> = {
  title: '業務模組元件/首頁(Landing)/HomePageCtaButton',
  component: HomePageCtaButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['hero', 'role', 'closing'],
      description:
        '首頁 CTA 按鈕區塊變體（Hero 主視覺、角色雙軌區、頁尾收尾區）',
    },
  },
  args: {
    variant: 'hero',
  },
};

export default meta;
type Story = StoryObj<typeof HomePageCtaButton>;

function AllVariantsShowcase({ variant }: HomePageCtaButtonProps) {
  return (
    <div className="bg-background-white flex flex-col gap-6 rounded-xl p-6">
      <div className="flex flex-col gap-2">
        <span className="text-text-tertiary text-xs font-medium">
          當前選取變體 ({variant})
        </span>
        <div>
          <HomePageCtaButton variant={variant} />
        </div>
      </div>
      <div className="border-background-border flex flex-col gap-4 border-t pt-4">
        <span className="text-text-tertiary text-xs font-medium">
          全站首頁三處 CTA 對照 (Hero / Role / Closing)
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
          <HomePageCtaButton variant="closing" />
        </div>
      </div>
    </div>
  );
}

export const GuestState: Story = {
  parameters: {
    auth: {
      status: 'unauthenticated',
      session: null,
      sessionHint: undefined,
    },
  },
  render: (args) => <AllVariantsShowcase {...args} />,
};

export const MenteeState: Story = {
  parameters: {
    auth: {
      status: 'authenticated',
      session: {
        user: {
          id: 'mentee-456',
          email: 'mentee@xchange.tw',
          name: '林學員 (Mentee)',
          onBoarding: true,
          isMentor: false,
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      sessionHint: '0|mentee-456',
    },
  },
  render: (args) => <AllVariantsShowcase {...args} />,
};

export const MentorState: Story = {
  parameters: {
    auth: {
      status: 'authenticated',
      session: {
        user: {
          id: 'mentor-123',
          email: 'mentor@xchange.tw',
          name: '陳導師 (Mentor)',
          onBoarding: true,
          isMentor: true,
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      sessionHint: '1|mentor-123',
    },
  },
  render: (args) => <AllVariantsShowcase {...args} />,
};

export const LoadingSkeleton: Story = {
  parameters: {
    auth: {
      status: 'loading',
      session: null,
      sessionHint: undefined,
    },
  },
  render: (args) => <AllVariantsShowcase {...args} />,
};
