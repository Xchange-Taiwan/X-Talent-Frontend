import { apiClient,ApiError } from '@/lib/apiClient';

export async function resendVerificationEmail(email: string): Promise<void> {
  console.log('[resend] request payload:', { email });
  try {
    await apiClient.post('/v1/auth/email/resend', { email }, { auth: false });
    console.log('[resend] success');
  } catch (error) {
    if (error instanceof ApiError) {
      console.log('[resend] ApiError:', {
        status: error.status,
        message: error.message,
        body: error.body,
      });
    } else {
      console.log('[resend] unknown error:', error);
    }
    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
