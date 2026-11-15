import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { HomePageHero } from './HomePageHero';

const meta: Meta<typeof HomePageHero> = {
  title: '業務模組元件/首頁(Landing)/HomePageHero',
  component: HomePageHero,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof HomePageHero>;

export const GuestState: Story = {
  parameters: {
    auth: {
      status: 'unauthenticated',
      session: null,
      sessionHint: undefined,
    },
  },
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
};

export const LoadingSkeleton: Story = {
  parameters: {
    auth: {
      status: 'loading',
      session: null,
      sessionHint: undefined,
    },
  },
};

export const ShortViewportFrame: Story = {
  parameters: {
    auth: {
      status: 'unauthenticated',
      session: null,
      sessionHint: undefined,
    },
  },
  render: () => (
    <div className="border-background-border bg-background-white mx-auto max-w-[720px] overflow-hidden border">
      <HomePageHero className="min-h-[380px]" />
    </div>
  ),
};
