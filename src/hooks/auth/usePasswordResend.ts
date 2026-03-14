import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { resetPassword } from '@/services/auth/resetPasswordByEmail';
import { AuthResponse } from '@/services/types';

export default function usePasswordResend() {
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('pending_reset_email');
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleResend = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: '發送失敗',
        description: '找不到您的電子郵件地址，請嘗試重新操作。',
      });
      return;
    }

    setIsResending(true);

    try {
      const response = await resetPassword(email);
      if (response.code === 200) {
        toast({
          title: '已成功重新發送',
          description: '請至您的電子郵箱查看。',
        });
      }
    } catch (error) {
      const err = error as AuthResponse;
      toast({
        variant: 'destructive',
        title: '信件寄送失敗',
        description: err.message || '發生錯誤，請稍後再試。',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    router.push('/auth/password-forgot');
  };

  return { email, isResending, handleResend, handleChangeEmail };
}
