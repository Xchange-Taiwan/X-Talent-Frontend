import { Decorator } from '@storybook/react';
import { SessionContext, SessionContextValue } from 'next-auth/react';
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

  // 1. Support parameter configurations from auth (used in Header.stories.tsx)
  const authParams = context.parameters.auth || {};
  const sessionHint = authParams.sessionHint;

  // Handle cookie sync if auth parameters are explicitly provided
  if (typeof window !== 'undefined') {
    if (sessionHint !== undefined) {
      document.cookie = `session-hint=${sessionHint}; path=/; max-age=3600`;
    } else {
      // Unconditionally clear the cookie when sessionHint is undefined
      // to avoid environment pollution across story switches
      document.cookie = 'session-hint=; path=/; max-age=0';
    }
  }

  // 2. Determine user: check auth parameters, standard parameters, then args
  const userFromParam =
    authParams.session?.user !== undefined
      ? authParams.session.user
      : context.parameters.user !== undefined
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

  // 3. Determine session
  let session = null;
  if (user !== null) {
    session = {
      user,
      accessToken: 'mock-access-token',
      expires: '2099-01-01T00:00:00.000Z',
    };
  }

  // Override session if directly provided in parameters or args
  if (authParams.session !== undefined) {
    session = authParams.session;
  } else if (context.parameters.session !== undefined) {
    session = context.parameters.session;
  } else if (context.args.session !== undefined) {
    session = context.args.session;
  }

  // 4. Determine session status
  let status = session ? 'authenticated' : 'unauthenticated';
  if (authParams.status !== undefined) {
    status = authParams.status;
  } else if (context.parameters.status !== undefined) {
    status = context.parameters.status;
  } else if (context.args.status !== undefined) {
    status = context.args.status;
  }

  const contextValue: SessionContextValue = {
    data: session,
    status: status as SessionContextValue['status'],
    update: async () => null,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      <Story />
    </SessionContext.Provider>
  );
};
