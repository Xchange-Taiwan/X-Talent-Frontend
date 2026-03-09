import { apiClient } from '@/lib/apiClient';

export async function resendVerificationEmail(email: string): Promise<void> {
  try {
    await apiClient.post('/v1/auth/email/resend', { email }, { auth: false });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
