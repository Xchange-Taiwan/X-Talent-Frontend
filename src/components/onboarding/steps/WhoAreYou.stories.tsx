import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

import { step1Schema } from './index';
import { WhoAreYou } from './WhoAreYou';

// Wrapper component to provide form context and simulate different values/validation
const WhoAreYouFormWrapper = ({
  initialValues,
  session,
}: {
  initialValues?: { name: string; avatar?: string };
  session?: import('next-auth').Session | null;
}) => {
  const form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: initialValues?.name ?? '',
      avatar: initialValues?.avatar ?? '',
      avatarFile: undefined,
      language: 'zh_TW',
    },
  });

  return (
    <SessionProvider session={session}>
      <Form {...form}>
        <div className="max-w-md rounded-lg border border-border bg-background-white p-6 shadow-sm">
          <WhoAreYou form={form} />
        </div>
      </Form>
    </SessionProvider>
  );
};

const meta: Meta<typeof WhoAreYou> = {
  title: 'Onboarding/Steps/WhoAreYou',
  component: WhoAreYou,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WhoAreYou>;

export const LoadingOrUnresolved: Story = {
  render: () => <WhoAreYouFormWrapper session={null} />,
};

export const MentorSelected: Story = {
  render: () => (
    <WhoAreYouFormWrapper
      initialValues={{
        name: '王小明 (Mentor)',
        avatar:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      }}
      session={{
        user: {
          id: 'user-mentor-123',
          name: '王小明 (Mentor)',
          avatar:
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          avatarUpdatedAt: 123456789,
          isMentor: true,
        },
        expires: '2027-01-01T00:00:00.000Z',
      }}
    />
  ),
};

export const MenteeSelected: Story = {
  render: () => (
    <WhoAreYouFormWrapper
      initialValues={{
        name: '陳小美 (Mentee)',
        avatar:
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      }}
      session={{
        user: {
          id: 'user-mentee-123',
          name: '陳小美 (Mentee)',
          avatar:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
          avatarUpdatedAt: 123456789,
          isMentor: false,
        },
        expires: '2027-01-01T00:00:00.000Z',
      }}
    />
  ),
};
