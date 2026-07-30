import type { Decorator } from '@storybook/react';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

export const defaultMockSession: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    onBoarding: true,
    isMentor: false,
  },
  accessToken: 'mock-access-token',
  expires: '2099-01-01T00:00:00.000Z',
};

export const withAppContext: Decorator = (Story, context) => {
  // Check if session or user is explicitly disabled / set to null in args or parameters
  const hasNullSessionArg =
    context.args.session === null || context.args.user === null;
  const hasNullSessionParam =
    context.parameters?.session === null || context.parameters?.auth === null;

  if (hasNullSessionArg || hasNullSessionParam) {
    // Unauthenticated state
    return (
      <SessionProvider session={null}>
        <Story />
      </SessionProvider>
    );
  }

  // Determine user to use (checking args first, then parameters)
  const argUser = context.args.user;
  const paramUser =
    context.parameters?.session?.user ||
    context.parameters?.auth?.session?.user;

  // Determine full session to use (checking args first, then parameters)
  const argSession = context.args.session;
  const paramSession =
    context.parameters?.session || context.parameters?.auth?.session;

  let sessionToPass: Session | null = null;

  if (argSession) {
    sessionToPass = argSession;
  } else if (paramSession) {
    sessionToPass = paramSession;
  } else if (argUser) {
    sessionToPass = {
      ...defaultMockSession,
      user: {
        ...defaultMockSession.user,
        ...argUser,
      },
    };
  } else if (paramUser) {
    sessionToPass = {
      ...defaultMockSession,
      user: {
        ...defaultMockSession.user,
        ...paramUser,
      },
    };
  } else {
    // Fallback to default mock session
    sessionToPass = defaultMockSession;
  }

  return (
    <SessionProvider session={sessionToPass}>
      <Story />
    </SessionProvider>
  );
};
