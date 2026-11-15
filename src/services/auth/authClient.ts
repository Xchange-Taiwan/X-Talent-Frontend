import { apiClient, ApiError } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type DeleteAccountDTO = components['schemas']['DeleteAccountDTO'];
export type GoogleAuthorizeVO = components['schemas']['GoogleAuthorizeVO'];

export type DeleteAccountResult =
  | { status: 'success' }
  | { status: 'blocked_reservations' }
  | { status: 'error'; message: string };

export interface SignUpInput {
  email: string;
  password: string;
  confirm_password: string;
}

export interface ResetPasswordWithTokenInput {
  verifyToken: string;
  password: string;
  confirmPassword: string;
}

export interface AuthClient {
  signUp(input: SignUpInput): Promise<void>;
  confirmSignUp(token: string): Promise<void>;
  resendVerificationEmail(email: string): Promise<void>;
  requestPasswordResetEmail(email: string): Promise<void>;
  resetPasswordWithToken(input: ResetPasswordWithTokenInput): Promise<void>;
  getGoogleAuthorizeUrl(intent: 'login' | 'signup'): Promise<GoogleAuthorizeVO>;
  deleteAccount(payload: DeleteAccountDTO): Promise<DeleteAccountResult>;
  postBackendLogout(): Promise<void>;
}

const BACKEND_LOGOUT_TIMEOUT_MS = 3000;

export function createAuthClient(
  client: Pick<
    typeof apiClient,
    'getUnwrapped' | 'postUnwrapped' | 'putUnwrapped' | 'deleteUnwrapped'
  > = apiClient
): AuthClient {
  return {
    async signUp(input) {
      await client.postUnwrapped<null>(
        '/v1/auth/signup',
        {
          email: input.email,
          password: input.password,
          confirm_password: input.confirm_password,
        },
        { auth: false }
      );
    },

    async confirmSignUp(token) {
      await client.postUnwrapped<null>(
        '/v1/auth/signup/confirm',
        { token },
        { auth: false }
      );
    },

    async resendVerificationEmail(email) {
      await client.postUnwrapped<null>(
        '/v1/auth/email/resend',
        { email },
        { auth: false }
      );
    },

    async requestPasswordResetEmail(email) {
      await client.getUnwrapped<null>('/v1/auth/password/reset/email', {
        params: { email },
        auth: false,
      });
    },

    async resetPasswordWithToken({ verifyToken, password, confirmPassword }) {
      await client.putUnwrapped<null>(
        '/v1/auth/password/reset',
        { password, confirm_password: confirmPassword },
        { auth: false, params: { verify_token: verifyToken } }
      );
    },

    async getGoogleAuthorizeUrl(intent) {
      const endpoint =
        intent === 'login'
          ? '/v2/oauth/google/authorize/login'
          : '/v2/oauth/google/authorize/signup';

      const data = await client.postUnwrapped<GoogleAuthorizeVO>(
        endpoint,
        {},
        { auth: false }
      );

      if (!data?.authorization_url) {
        throw new ApiError(502, '無法取得 Google 授權連結');
      }

      return data;
    },

    async deleteAccount(payload) {
      if (process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT !== 'true') {
        return { status: 'error', message: '此環境不支援帳號刪除' };
      }

      try {
        await client.deleteUnwrapped<null>('/v1/auth/account', payload);
        return { status: 'success' };
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 409) {
            return { status: 'blocked_reservations' };
          }
          return { status: 'error', message: error.message };
        }
        return { status: 'error', message: '系統錯誤，請稍後再試' };
      }
    },

    async postBackendLogout() {
      await client.postUnwrapped<null>('/api/auth/backend-logout', undefined, {
        auth: false,
        isLocal: true,
        signal: AbortSignal.timeout(BACKEND_LOGOUT_TIMEOUT_MS),
      });
    },
  };
}

export const authClient: AuthClient = createAuthClient();
