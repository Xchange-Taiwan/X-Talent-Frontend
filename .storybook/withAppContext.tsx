import React from 'react';
import type { Decorator } from '@storybook/react';
import { SessionContext, SessionContextValue } from 'next-auth/react';
import type { Session } from 'next-auth';

export const defaultMockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  onBoarding: true,
  isMentor: false,
};

export const defaultMockSession: Session = {
  user: defaultMockUser,
  accessToken: 'mock-access-token',
  expires: '2099-01-01T00:00:00.000Z',
};

export interface ResolveMockSessionResult {
  session: Session | null;
  status: 'authenticated' | 'unauthenticated' | 'loading';
}

/**
 * Pure function to resolve the mock session and status from Storybook parameters and args,
 * fully preserving all flexible configurations and maintaining 100% strict type safety.
 */
export function resolveMockSession(
  params?: {
    auth?: {
      session?: Session | null;
      status?: 'authenticated' | 'unauthenticated' | 'loading';
    } | null;
    user?: Partial<Session['user']> | null;
    session?: Session | null;
    status?: 'authenticated' | 'unauthenticated' | 'loading';
  },
  args?: {
    user?: Partial<Session['user']> | null;
    session?: Session | null;
    status?: 'authenticated' | 'unauthenticated' | 'loading';
  }
): ResolveMockSessionResult {
  const authParams = params?.auth || {};

  // 1. Resolve user
  const userFromParam =
    authParams.session?.user !== undefined
      ? authParams.session.user
      : params?.user !== undefined
        ? params?.user
        : params?.session?.user !== undefined
          ? params?.session?.user
          : undefined;

  const user =
    userFromParam !== undefined
      ? userFromParam
      : args?.user !== undefined
        ? args?.user
        : defaultMockUser;

  // 2. Resolve default session from user
  let session: Session | null = null;
  if (user !== null) {
    session = {
      ...defaultMockSession,
      user: {
        ...defaultMockSession.user,
        ...user,
      },
    } as Session;
  }

  // 3. Override session if directly provided
  if (authParams.session !== undefined) {
    session = authParams.session;
  } else if (params?.session !== undefined) {
    session = params?.session;
  } else if (args?.session !== undefined) {
    session = args?.session;
  }

  // 4. Determine session status
  let status: 'authenticated' | 'unauthenticated' | 'loading' = session ? 'authenticated' : 'unauthenticated';
  if (authParams.status !== undefined) {
    status = authParams.status;
  } else if (params?.status !== undefined) {
    status = params?.status;
  } else if (args?.status !== undefined) {
    status = args?.status;
  }

  return { session, status };
}

/**
 * Shared Storybook decorator to provide NextAuth `SessionProvider` (via SessionContext.Provider) with configurable mocks.
 * By default, stories are authenticated with a standard test session.
 * 
 * To override the default user or session:
 * 1. Via parameters (Recommended for components without user/session Props to avoid TypeScript strict compile errors):
 *    - `parameters: { nextAuth: { user: { name: 'Custom PM', isMentor: true } } }`
 *    - `parameters: { nextAuth: { session: null } }` (unauthenticated guest states)
 * 
 * 2. Via args (Best for components like UserDropdown that accept user/session as direct Props):
 *    - `args: { user: { name: 'Custom Name' } }`
 *    - `args: { user: null }`
 */
export const withAppContext: Decorator = (Story, context) => {
  const authParams = context.parameters?.auth || {};
  const sessionHint = authParams.sessionHint;

  // Handle cookie sync if auth parameters are explicitly provided
  if (typeof window !== 'undefined') {
    if (sessionHint !== undefined) {
      document.cookie = `session-hint=${sessionHint}; path=/; max-age=3600`;
    } else {
      document.cookie = 'session-hint=; path=/; max-age=0';
    }
  }

  // Resolve mock session and status from parameters or args
  const { session, status } = resolveMockSession(context.parameters, context.args);

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
export default withAppContext;
