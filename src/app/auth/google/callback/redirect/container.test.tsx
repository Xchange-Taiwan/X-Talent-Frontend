import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidateProfilePathAfterDelete } from '@/app/profile/[pageUserId]/actions';
import { trackEvent } from '@/lib/analytics';
import {
  clearPendingDeleteAccountEmail,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import { deleteAccount } from '@/services/auth/deleteAccount';
import type { components } from '@/types/api';

import GoogleOAuthRedirectPage from './container';

type ProfileVO = components['schemas']['ProfileVO'];

// Setup hoisted mocks to prevent ReferenceErrors during hoisting
const { mockGetSession, mockSignOut, pushMock, mockToast } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  pushMock: vi.fn(),
  mockToast: vi.fn(),
}));

// Mock Router and SearchParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'code') return 'mock_code';
      if (key === 'state') return 'mock_state';
      return null;
    },
  }),
}));

// Mock Toast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  getSession: () => mockGetSession(),
  signOut: mockSignOut,
}));

// Mock actions and services
vi.mock('@/app/profile/[pageUserId]/actions', () => ({
  revalidateProfilePathAfterDelete: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/services/auth/deleteAccount', () => ({
  deleteAccount: vi.fn(),
}));

// Mock oauthOutcome helpers
vi.mock('@/lib/auth/oauthOutcome', () => ({
  getPendingDeleteAccountEmail: vi.fn(),
  clearPendingDeleteAccountEmail: vi.fn(),
  resolveOAuthOutcome: vi.fn(),
  signInWithGoogleToken: vi.fn(),
}));

const mockClearPendingDeleteEmail = vi.mocked(clearPendingDeleteAccountEmail);
const mockResolveOAuthOutcome = vi.mocked(resolveOAuthOutcome);
const mockSignInWithGoogleToken = vi.mocked(signInWithGoogleToken);
const mockDeleteAccount = vi.mocked(deleteAccount);
const mockRevalidateProfileAfterDelete = vi.mocked(
  revalidateProfilePathAfterDelete
);
const mockTrackEvent = vi.mocked(trackEvent);

describe('GoogleOAuthRedirectPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevalidateProfileAfterDelete.mockResolvedValue(undefined);

    // Stub sessionStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      getItem: (key: string) => store[key] || null,
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      },
    });
  });

  it('renders loading spinner and redirecting texts initially', () => {
    mockResolveOAuthOutcome.mockResolvedValue({
      type: 'INVALID',
      errorType: 'MISSING_PARAMS',
    });

    render(<GoogleOAuthRedirectPage />);

    expect(
      screen.getByText('Signing you in with Google...')
    ).toBeInTheDocument();
  });

  it('prevents duplicate side-effect executions when component re-renders (Strict Mode)', async () => {
    mockResolveOAuthOutcome.mockResolvedValue({
      type: 'INVALID',
      errorType: 'MISSING_PARAMS',
    });

    const { rerender } = render(<GoogleOAuthRedirectPage />);
    rerender(<GoogleOAuthRedirectPage />);

    await waitFor(() => {
      expect(mockResolveOAuthOutcome).toHaveBeenCalledTimes(1);
    });
  });

  describe('Invalid Outcome', () => {
    it('handles MISSING_PARAMS correctly and clears pending email', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'INVALID',
        errorType: 'MISSING_PARAMS',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Missing Google OAuth parameters',
          description: 'Authorization failed. Please try again.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        // Clears pending email for missing params to prevent landmines
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
      });
    });

    it('handles DELETE_FLOW_INVALID correctly and clears pending email', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'INVALID',
        errorType: 'DELETE_FLOW_INVALID',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: '無法取得 Google 憑證，請稍後再試',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        // Clears pending email to prevent landmines
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
      });
    });

    it('handles CALLBACK_FAILED correctly and clears pending email', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'INVALID',
        errorType: 'CALLBACK_FAILED',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        // Clears pending email to prevent landmines
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Signup Outcome', () => {
    it('stores email in sessionStorage and redirects to email-verify', async () => {
      const mockData = {
        auth_type: 'SIGNUP' as const,
        auth: { token: 'tok_1', email: 'signup@example.com' },
        user: null,
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'SIGNUP',
        data: mockData,
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(sessionStorage.getItem('email')).toBe('signup@example.com');
        expect(pushMock).toHaveBeenCalledWith('/auth/email-verify');
      });
    });
  });

  describe('Login Outcome', () => {
    it('redirects to onboarding if session onBoarding is false', async () => {
      const mockData = {
        auth_type: 'LOGIN' as const,
        auth: { token: 'tok_2', email: 'user@example.com' },
        user: { user_id: 456 } as unknown as ProfileVO,
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'LOGIN',
        data: mockData,
      });

      mockGetSession.mockResolvedValue({
        user: { onBoarding: false },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockSignInWithGoogleToken).toHaveBeenCalledWith(
          'tok_2',
          'user@example.com',
          { user_id: 456 } as unknown as Record<string, unknown>
        );
        expect(pushMock).toHaveBeenCalledWith('/auth/onboarding');
      });
    });

    it('redirects to mentor-pool if session onBoarding is true', async () => {
      const mockData = {
        auth_type: 'LOGIN' as const,
        auth: { token: 'tok_2', email: 'user@example.com' },
        user: { user_id: 456 } as unknown as ProfileVO,
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'LOGIN',
        data: mockData,
      });

      mockGetSession.mockResolvedValue({
        user: { onBoarding: true },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/mentor-pool');
      });
    });

    it('intercepts missing user or auth token during login execution', async () => {
      const mockDataMissingToken = {
        auth_type: 'LOGIN' as const,
        auth: { token: null, email: 'user@example.com' },
        user: { user_id: 456 } as unknown as ProfileVO,
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'LOGIN',
        data: mockDataMissingToken,
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Missing login data',
          description: 'OAuth response is missing required fields.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(mockSignInWithGoogleToken).not.toHaveBeenCalled();
      });
    });

    it('handles unexpected async exceptions during login and resets loading', async () => {
      const mockData = {
        auth_type: 'LOGIN' as const,
        auth: { token: 'tok_2', email: 'user@example.com' },
        user: { user_id: 456 } as unknown as ProfileVO,
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'LOGIN',
        data: mockData,
      });

      // Rejecting getSession to trigger unexpected exception inside handleOAuthFlow try-catch
      mockGetSession.mockRejectedValue(new Error('Network error'));

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        // Spinner is hidden, displaying "Redirecting..." instead of "Signing you in with Google..."
        expect(screen.getByText('Redirecting...')).toBeInTheDocument();
      });
    });
  });

  describe('Resume Delete Account Outcome', () => {
    const mockData = {
      auth_type: 'LOGIN' as const,
      auth: { token: 'tok_3', email: 'user@example.com' },
      user: { user_id: 789, name: 'Delete Me' } as unknown as ProfileVO,
      id_token: 'id_token_123',
    };

    it('handles successful account deletion flow', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockData,
        email: 'delete@example.com',
      });

      mockDeleteAccount.mockResolvedValue({
        status: 'success',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        // Must clear pending delete email
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);

        // Sign in first
        expect(mockSignInWithGoogleToken).toHaveBeenCalledWith(
          'tok_3',
          'user@example.com',
          { user_id: 789, name: 'Delete Me' } as unknown as Record<
            string,
            unknown
          >
        );

        // Calls delete account API
        expect(mockDeleteAccount).toHaveBeenCalledWith({
          email: 'delete@example.com',
          id_token: 'id_token_123',
        });

        // Track and revalidate profile
        expect(mockTrackEvent).toHaveBeenCalledWith({
          name: 'delete_account_succeeded',
          feature: 'auth',
        });
        expect(mockRevalidateProfileAfterDelete).toHaveBeenCalledWith(
          '789',
          'Delete Me'
        );

        // Performs NextAuth signOut
        expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
      });

      // revalidateProfilePathAfterDelete must resolve before signOut, but it
      // returns immediately (the wait runs server-side, after the response).
      const revalidateOrder =
        mockRevalidateProfileAfterDelete.mock.invocationCallOrder[0];
      const signOutOrder = mockSignOut.mock.invocationCallOrder[0];
      expect(revalidateOrder).toBeLessThan(signOutOrder);
    });

    it('handles blocked by reservations deletion flow correctly', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockData,
        email: 'delete@example.com',
      });

      mockDeleteAccount.mockResolvedValue({
        status: 'blocked_reservations',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '無法刪除帳號',
          description: '您目前有未完成或未來的預約，請先處理後再刪除帳號。',
        });
        expect(pushMock).toHaveBeenCalledWith('/reservation/mentee');
      });
    });

    it('handles general error deletion flow correctly', async () => {
      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockData,
        email: 'delete@example.com',
      });

      mockDeleteAccount.mockResolvedValue({
        status: 'error',
        message: 'Database error',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: 'Database error',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
      });
    });

    it('handles missing required token in deletion flow by aborting and clearing marker at top', async () => {
      const mockDataMissingIdToken = {
        auth_type: 'LOGIN' as const,
        auth: { token: 'tok_3', email: 'user@example.com' },
        user: { user_id: 789 } as unknown as ProfileVO,
        id_token: null, // missing id_token
      };

      mockResolveOAuthOutcome.mockResolvedValue({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockDataMissingIdToken,
        email: 'delete@example.com',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        // Clears email marker at the absolute top of execution first
        expect(mockClearPendingDeleteEmail).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: '無法取得 Google 憑證，請稍後再試',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(mockSignInWithGoogleToken).not.toHaveBeenCalled();
        expect(mockDeleteAccount).not.toHaveBeenCalled();
      });
    });
  });
});
