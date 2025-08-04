interface ConfirmRegisterResponse {
  msg?: string;
}

export async function confirmRegister(token: string): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/signup/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      const result: ConfirmRegisterResponse = await response.json();
      throw new Error(result.msg || '驗證失敗');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
