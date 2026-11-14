import { render, screen, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { googleCallback } from '@/lib/actions/googleCallback';
import {
  clearAnalyticsUser,
  setAnalyticsUserContext,
  trackEvent,
} from '@/lib/analytics';
import {
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/auth/authFlowStorage';
import { deleteAccount } from '@/services/auth/deleteAccount';
import type { components } from '@/types/api';

import GoogleOAuthRedirectPage from './container';

type ProfileVO = components['schemas']['ProfileVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

const {
  mockGetSession,
  mockSignIn,
  mockSignOut,
  pushMock,
  mockToast,
  searchParamsState,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  pushMock: vi.fn(),
  mockToast: vi.fn(),
  searchParamsState: {
    code: 'mock_code' as string | null,
    state: 'mock_state' as string | null,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'code') return searchParamsState.code;
      if (key === 'state') return searchParamsState.state;
      return null;
    },
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('next-auth/react', () => ({
  getSession: () => mockGetSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: mockSignOut,
}));

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    clearAnalyticsUser: vi.fn(),
    setAnalyticsUserContext: vi.fn(),
    trackEvent: vi.fn(),
  };
});

vi.mock('@/actions/auth', () => ({
  revalidateProfilePathAfterDelete: vi.fn(),
}));

vi.mock('@/lib/actions/googleCallback', () => ({
  googleCallback: vi.fn(),
}));

vi.mock('@/services/auth/deleteAccount', () => ({
  deleteAccount: vi.fn(),
}));

const mockGoogleCallback = vi.mocked(googleCallback);
const mockDeleteAccount = vi.mocked(deleteAccount);
const mockRevalidateProfilePathAfterDelete = vi.mocked(
  revalidateProfilePathAfterDelete
);
const mockClearAnalyticsUser = vi.mocked(clearAnalyticsUser);
const mockSetAnalyticsUserContext = vi.mocked(setAnalyticsUserContext);
const mockTrackEvent = vi.mocked(trackEvent);

describe('GoogleOAuthRedirectPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.code = 'mock_code';
    searchParamsState.state = 'mock_state';
    mockSignIn.mockResolvedValue({ error: undefined, ok: true });
    mockRevalidateProfilePathAfterDelete.mockResolvedValue(undefined);

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
    searchParamsState.code = null;

    render(<GoogleOAuthRedirectPage />);

    expect(
      screen.getByText('Signing you in with Google...')
    ).toBeInTheDocument();
  });

  it('prevents duplicate side-effect executions when component re-renders (Strict Mode)', async () => {
    mockGoogleCallback.mockResolvedValue(
      fromPartial<OAuthCallbackResponse>({ code: '1' })
    );

    const { rerender } = render(<GoogleOAuthRedirectPage />);
    rerender(<GoogleOAuthRedirectPage />);

    await waitFor(() => {
      expect(mockGoogleCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Invalid Outcome', () => {
    it('handles MISSING_PARAMS correctly and clears pending email', async () => {
      searchParamsState.code = null;
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Missing Google OAuth parameters',
          description: 'Authorization failed. Please try again.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('handles DELETE_FLOW_INVALID correctly and clears pending email', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'SIGNUP',
            auth: { token: 'tok_1', email: 'signup@example.com' },
            user: null,
          },
        })
      );

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: '無法取得 Google 憑證，請稍後再試',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('handles CALLBACK_FAILED correctly and clears pending email', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockRejectedValue(new Error('BFF unavailable'));

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });
  });

  describe('Signup Outcome', () => {
    it('tracks sign_up (method: Google, user_role: guest), clears stale pending_auth_callback_url, stores email in sessionStorage, and redirects to email-verify', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'SIGNUP',
            auth: { token: 'tok_1', email: 'signup@example.com' },
            user: null,
          },
        })
      );

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith({
          name: 'sign_up',
          feature: 'auth',
          metadata: {
            method: 'Google',
            user_role: 'guest',
          },
        });
        expect(sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBe(
          'signup@example.com'
        );
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
        expect(pushMock).toHaveBeenCalledWith('/auth/email-verify');
      });
    });
  });

  describe('Login Outcome', () => {
    it('syncs user_id, tracks login (method: Google), and redirects to onboarding if session onBoarding is false', async () => {
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        accessToken: 'tok_2',
        user: { onBoarding: false },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('custom-google-token', {
          redirect: false,
          token: 'tok_2',
          email: 'user@example.com',
          user: JSON.stringify({ user_id: 456 }),
        });
        expect(mockSetAnalyticsUserContext).toHaveBeenCalledWith({
          userId: '456',
          userRole: 'mentee',
        });
        expect(mockTrackEvent).toHaveBeenCalledWith({
          name: 'login',
          feature: 'auth',
          metadata: {
            method: 'Google',
            user_role: 'mentee',
          },
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/onboarding');
      });
    });

    it('prioritizes /auth/onboarding over pending_auth_callback_url and clears sessionStorage when onBoarding is false (#733)', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );

      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        accessToken: 'tok_2',
        user: { onBoarding: false },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/auth/onboarding');
        expect(pushMock).not.toHaveBeenCalledWith(
          '/reservation/mentee?tab=history&reservationId=101'
        );
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('redirects to mentor-pool if session onBoarding is true', async () => {
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        accessToken: 'tok_2',
        user: { onBoarding: true },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/mentor-pool');
      });
    });

    it('redirects to sanitized pending_auth_callback_url and clears sessionStorage when onBoarding is true (#733)', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );

      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        accessToken: 'tok_2',
        user: { onBoarding: true },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith(
          '/reservation/mentee?tab=history&reservationId=101'
        );
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('falls back to /mentor-pool when pending_auth_callback_url normalizes to a protocol-relative // path (#733)', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/foo/..//evil.example.com/phish'
      );

      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        accessToken: 'tok_2',
        user: { onBoarding: true },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/mentor-pool');
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('rejects login and redirects to /auth/signin when getSession lacks accessToken (#885)', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );

      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockResolvedValue({
        user: { onBoarding: true },
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('intercepts missing user or auth token during login execution and clears pending_auth_callback_url', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: null, email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Missing login data',
          description: 'OAuth response is missing required fields.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(mockSignIn).not.toHaveBeenCalled();
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
      });
    });

    it('handles unexpected async exceptions during login, clears pending_auth_callback_url, and resets loading', async () => {
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_2', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 456 }),
          },
        })
      );

      mockGetSession.mockRejectedValue(new Error('Network error'));

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();
        expect(screen.getByText('Redirecting...')).toBeInTheDocument();
      });
    });
  });

  describe('Resume Delete Account Outcome', () => {
    const mockDeleteCallbackResponse = fromPartial<OAuthCallbackResponse>({
      data: {
        auth_type: 'LOGIN',
        auth: { token: 'tok_3', email: 'user@example.com' },
        user: fromPartial<ProfileVO>({ user_id: 789, name: 'Delete Me' }),
        id_token: 'id_token_123',
      },
    });

    it('handles successful account deletion flow', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee?tab=history&reservationId=101'
      );
      mockGoogleCallback.mockResolvedValue(mockDeleteCallbackResponse);

      mockDeleteAccount.mockResolvedValue({
        status: 'success',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(
          sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
        ).toBeNull();

        expect(mockSignIn).toHaveBeenCalledWith('custom-google-token', {
          redirect: false,
          token: 'tok_3',
          email: 'user@example.com',
          user: JSON.stringify({ user_id: 789, name: 'Delete Me' }),
        });

        expect(mockDeleteAccount).toHaveBeenCalledWith({
          email: 'delete@example.com',
          id_token: 'id_token_123',
        });

        expect(mockTrackEvent).toHaveBeenCalledWith({
          name: 'delete_account_succeeded',
          feature: 'auth',
        });
        expect(mockClearAnalyticsUser).toHaveBeenCalledTimes(1);
        expect(mockRevalidateProfilePathAfterDelete).toHaveBeenCalledWith();
        expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
      });

      const dispatchOrder =
        mockRevalidateProfilePathAfterDelete.mock.invocationCallOrder[0];
      const signOutOrder = mockSignOut.mock.invocationCallOrder[0];
      expect(dispatchOrder).toBeLessThan(signOutOrder);
    });

    it('handles blocked by reservations deletion flow correctly', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      mockGoogleCallback.mockResolvedValue(mockDeleteCallbackResponse);

      mockDeleteAccount.mockResolvedValue({
        status: 'blocked_reservations',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '無法刪除帳號',
          description: '您目前有未完成或未來的預約，請先處理後再刪除帳號。',
        });
        expect(pushMock).toHaveBeenCalledWith('/reservation/mentee');
      });
    });

    it('handles general error deletion flow correctly', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      mockGoogleCallback.mockResolvedValue(mockDeleteCallbackResponse);

      mockDeleteAccount.mockResolvedValue({
        status: 'error',
        message: 'Database error',
      });

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: 'Database error',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
      });
    });

    it('handles missing required token in deletion flow by aborting and clearing marker at top', async () => {
      sessionStorage.setItem(
        PENDING_DELETE_ACCOUNT_EMAIL_KEY,
        'delete@example.com'
      );
      mockGoogleCallback.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'tok_3', email: 'user@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 789 }),
            id_token: null,
          },
        })
      );

      render(<GoogleOAuthRedirectPage />);

      await waitFor(() => {
        expect(
          sessionStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
        ).toBeNull();
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: '無法取得 Google 憑證，請稍後再試',
        });
        expect(pushMock).toHaveBeenCalledWith('/auth/signin');
        expect(mockSignIn).not.toHaveBeenCalled();
        expect(mockDeleteAccount).not.toHaveBeenCalled();
      });
    });
  });
});
