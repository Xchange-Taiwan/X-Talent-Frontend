import type { Meta, StoryObj } from '@storybook/nextjs';
import { SessionProvider } from 'next-auth/react';

import SentryUserSync from './SentryUserSync';

const meta: Meta<typeof SentryUserSync> = {
  title: 'System/SentryUserSync',
  component: SentryUserSync,
  decorators: [
    (Story) => (
      <SessionProvider session={null}>
        <Story />
      </SessionProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SentryUserSync>;

export const GuestSession: Story = {};
