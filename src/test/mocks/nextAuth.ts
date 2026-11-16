import type { Session } from 'next-auth';
import type { SessionContextValue } from 'next-auth/react';
import { createContext } from 'react';
import { vi } from 'vitest';

export const MockSessionContext = createContext<
  SessionContextValue | undefined
>(undefined);

export const mockSession: Session = {
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

export const mockUseSession = vi.fn().mockReturnValue({
  data: mockSession,
  status: 'authenticated',
  update: vi.fn(),
});

export const mockGetSession = vi.fn().mockResolvedValue(mockSession);

export const mockSignIn = vi.fn().mockResolvedValue({ error: null });

export const mockSignOut = vi.fn();

export const nextAuthMockFactory = () => ({
  SessionContext: MockSessionContext,
  useSession: mockUseSession,
  getSession: mockGetSession,
  signIn: mockSignIn,
  signOut: mockSignOut,
});
