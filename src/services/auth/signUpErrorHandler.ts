import { AuthResponse } from '@/services/auth/types';

export const handleSignUpError = (
  result: AuthResponse,
  toast: (props: {
    variant: 'default' | 'destructive';
    title: string;
    description?: string;
  }) => void,
) => {
  const { code, message, httpStatus } = result;
  const errorDescription = `${message || '發生錯誤。'}`;

  switch (code) {
    case 422:
      toast({
        variant: 'destructive',
        title: '驗證失敗',
        description: errorDescription,
      });
      break;
    case 406:
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: errorDescription,
      });
      break;
    case 42900:
      toast({
        variant: 'destructive',
        title: '請求過於頻繁',
        description: errorDescription,
      });
      break;
    default:
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: `${errorDescription} - HTTP狀態碼: ${httpStatus}。`,
      });
      break;
  }
};
