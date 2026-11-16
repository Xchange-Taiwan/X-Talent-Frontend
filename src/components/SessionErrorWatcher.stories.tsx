import type { Meta, StoryObj } from '@storybook/nextjs';
import { useSession } from 'next-auth/react';
import React from 'react';

import SessionErrorWatcher from './SessionErrorWatcher';

function SessionErrorWatcherDemo({ scenarioLabel }: { scenarioLabel: string }) {
  const { data: session, status } = useSession();

  return (
    <div className="bg-background-white border-background-border space-y-3 rounded-lg border p-6">
      <SessionErrorWatcher />
      <h3 className="text-text-primary text-base font-semibold">
        SessionErrorWatcher 狀態檢視 ({scenarioLabel})
      </h3>
      <div className="text-text-secondary space-y-1 text-sm">
        <p>
          Session Status: <code className="font-mono">{status}</code>
        </p>
        <p>
          Session Error:{' '}
          <code className="font-mono">{session?.error ?? '(none)'}</code>
        </p>
        <p>
          Access Token:{' '}
          <code className="font-mono">
            {session?.accessToken ? 'present' : '(cleared)'}
          </code>
        </p>
      </div>
    </div>
  );
}

const meta: Meta<typeof SessionErrorWatcher> = {
  title: '全站監視器/SessionErrorWatcher',
  component: SessionErrorWatcher,
};

export default meta;
type Story = StoryObj<typeof SessionErrorWatcher>;

export const HealthySession: Story = {
  parameters: {
    nextAuth: {
      status: 'authenticated',
      session: {
        user: {
          id: '1024',
          name: 'Alice Chen',
          isMentor: true,
          onBoarding: true,
        },
        accessToken: 'healthy-access-token',
        expires: '2027-12-31T00:00:00.000Z',
      },
    },
  },
  render: () => <SessionErrorWatcherDemo scenarioLabel="正常連線狀態" />,
};

export const UnauthenticatedVisitor: Story = {
  parameters: {
    nextAuth: {
      status: 'unauthenticated',
      session: null,
    },
  },
  render: () => <SessionErrorWatcherDemo scenarioLabel="未登入訪客" />,
};
