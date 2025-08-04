interface ResendEmailResponse {
  msg?: string;
}

export async function resendVerificationEmail(email: string): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/email/resend`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.status === 201) {
      return;
    }

    const result: ResendEmailResponse = await response.json();

    throw new Error(result.msg || '重新寄送失敗');
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
