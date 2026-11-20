import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';

import { useAuthPendingAction } from './useAuthPendingAction';

export function useGoogleAuth() {
  const router = useRouter();
  const { toast } = useToast();
  const { isPending, runPending } = useAuthPendingAction();

  const handleGoogleAuth = async (isSignIn: boolean) => {
    await runPending(
      () =>
        authLifecycle.startGoogleAuth(
          { isSignIn },
          {
            navigate: (url) => router.push(url),
            toast,
          }
        ),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return {
    handleGoogleAuth,
    isPending,
  };
}
