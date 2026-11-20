import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { isAccountDeletionEnabled } from '@/lib/featureFlags';
import { DeleteAccountXCSchema } from '@/schemas/auth';

import { useAuthPendingAction } from './useAuthPendingAction';

type XCValues = z.infer<typeof DeleteAccountXCSchema>;

export type DeleteAccountMode = 'xc' | 'google';

interface UseDeleteAccountFormReturn {
  mode: DeleteAccountMode;
  xcForm: ReturnType<typeof useForm<XCValues>>;
  isSubmitting: boolean;
  blockedByReservations: boolean;
  onSubmitXC: (values: XCValues) => Promise<void>;
  initiateGoogleReauth: () => Promise<void>;
}

export default function useDeleteAccountForm(): UseDeleteAccountFormReturn {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const {
    isPending: isSubmitting,
    isInFlight,
    runPending,
  } = useAuthPendingAction();
  const [blockedByReservations, setBlockedByReservations] = useState(false);

  const mode: DeleteAccountMode =
    session?.user?.provider === 'custom-google-token' ? 'google' : 'xc';

  const xcForm = useForm<XCValues>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: session?.user?.email ?? '', password: '' },
  });

  const onSubmitXC = async (values: XCValues): Promise<void> => {
    if (isInFlight()) return;
    if (!isAccountDeletionEnabled()) {
      await authLifecycle.deleteAccountXC(values, { toast });
      return;
    }

    await runPending(async () => {
      setBlockedByReservations(false);
      const result = await authLifecycle.deleteAccountXC(
        {
          email: values.email,
          password: values.password,
        },
        {
          signOut,
          revalidateAfterDelete: revalidateProfilePathAfterDelete,
          toast,
        }
      );
      if (result.status === 'blocked_reservations') {
        setBlockedByReservations(true);
      }
      return result;
    });
  };

  const initiateGoogleReauth = async (): Promise<void> => {
    if (isInFlight()) return;
    if (!isAccountDeletionEnabled()) {
      await authLifecycle.startDeleteAccountGoogleReauth(
        session?.user?.email ?? '',
        { toast }
      );
      return;
    }

    await runPending(
      () =>
        authLifecycle.startDeleteAccountGoogleReauth(
          session?.user?.email ?? '',
          {
            navigate: (url) => router.push(url),
            toast,
          }
        ),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return {
    mode,
    xcForm,
    isSubmitting,
    blockedByReservations,
    onSubmitXC,
    initiateGoogleReauth,
  };
}
