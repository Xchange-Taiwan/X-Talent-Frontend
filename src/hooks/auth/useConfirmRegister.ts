import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { confirmRegister } from '@/services/auth/confirmRegister';

export function useConfirmRegister() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [status, setStatus] = useState<'loading' | 'success' | 'failure'>(
    () => {
      return token ? 'loading' : 'failure';
    }
  );

  const processedTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (processedTokenRef.current === token) {
      return;
    }
    processedTokenRef.current = token;

    if (!token) {
      setStatus('failure');
      toast({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請驗證信。',
      });
      return;
    }

    setStatus('loading');

    const confirmSignup = async () => {
      try {
        await confirmRegister(token);
        if (processedTokenRef.current === token) {
          setStatus('success');
        }
      } catch (error) {
        if (processedTokenRef.current === token) {
          toast({
            variant: 'destructive',
            title: '註冊失敗',
            description:
              error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
          });
          setStatus('failure');
        }
      }
    };

    confirmSignup();
  }, [token, toast]);

  return { status };
}
