import { Decorator } from '@storybook/react';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

export const withAppContext: Decorator = (Story, context) => {
  // Standard default user shape from src/test/mocks/nextAuth.ts
  const defaultUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    onBoarding: true,
    isMentor: false,
  };

  // Determine user: check parameters first (avoids TypeScript props checking),
  // then fallback to args, then fallback to defaultUser.
  const userFromParam =
    context.parameters.user !== undefined
      ? context.parameters.user
      : context.parameters.session?.user !== undefined
        ? context.parameters.session.user
        : undefined;

  const user =
    userFromParam !== undefined
      ? userFromParam
      : context.args.user !== undefined
        ? context.args.user
        : defaultUser;

  let session = null;
  if (user !== null) {
    session = {
      user,
      accessToken: 'mock-access-token',
      expires: '2099-01-01T00:00:00.000Z',
    };
  }

  // Determine session override: check parameters first, then args.
  if (context.parameters.session !== undefined) {
    session = context.parameters.session;
  } else if (context.args.session !== undefined) {
    session = context.args.session;
  }

  return (
    <SessionProvider session={session}>
      <Story />
    </SessionProvider>
  );
};
