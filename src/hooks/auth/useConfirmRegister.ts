import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  ConfirmSignUpLifecycleError,
  confirmSignUpToken,
} from '@/lib/auth/sessionLifecycle';
import { captureFlowFailure } from '@/lib/monitoring';

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
      captureFlowFailure({
        flow: 'email_verification',
        step: 'missing_token',
        message: 'Missing signup confirmation token',
        level: 'info',
      });
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
        await confirmSignUpToken(token);
        if (processedTokenRef.current === token) {
          setStatus('success');
        }
      } catch (error) {
        if (processedTokenRef.current === token) {
          captureFlowFailure({
            flow: 'email_verification',
            step:
              error instanceof ConfirmSignUpLifecycleError
                ? error.step
                : 'confirm_token',
            message:
              error instanceof ConfirmSignUpLifecycleError
                ? error.logMessage
                : error instanceof Error
                  ? error.message
                  : 'Failed to confirm signup token',
            level:
              error instanceof ConfirmSignUpLifecycleError
                ? error.level
                : 'info',
            errorCode:
              error instanceof ConfirmSignUpLifecycleError
                ? error.errorCode
                : undefined,
          });
          toast({
            variant: 'destructive',
            title:
              error instanceof ConfirmSignUpLifecycleError
                ? error.title
                : '註冊失敗',
            description:
              error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
          });
          setStatus('failure');
        }
      }
    };

    void confirmSignup();
  }, [token, toast]);

  return { status };
}
