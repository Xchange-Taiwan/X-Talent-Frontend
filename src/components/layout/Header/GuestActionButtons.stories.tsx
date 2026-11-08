import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { GuestActionButtons } from './GuestActionButtons';

const meta: Meta<typeof GuestActionButtons> = {
  title: '佈局元件/Header/GuestActionButtons',
  component: GuestActionButtons,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background-white flex items-center gap-3 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GuestActionButtons>;

export const ConfirmedGuest: Story = {
  args: {
    identity: {
      state: 'confirmed-guest',
      userId: undefined,
      avatar: undefined,
      isMentor: false,
    },
  },
};

export const UnknownPreHydrationGuest: Story = {
  args: {
    identity: {
      state: 'unknown',
      userId: undefined,
      avatar: undefined,
      isMentor: false,
    },
  },
  decorators: [
    (Story) => (
      <div className="group/auth-state" data-auth-state="guest">
        <Story />
      </div>
    ),
  ],
};

export const HiddenForConfirmedMember: Story = {
  args: {
    identity: {
      state: 'confirmed-member',
      userId: 'user-123',
      avatar: undefined,
      isMentor: false,
    },
  },
};
