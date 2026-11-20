import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { isAccountDeletionEnabled } from '@/lib/featureFlags';
import { DeleteAccountXCSchema } from '@/schemas/auth';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const [blockedByReservations, setBlockedByReservations] = useState(false);

  const mode: DeleteAccountMode =
    session?.user?.provider === 'custom-google-token' ? 'google' : 'xc';

  const xcForm = useForm<XCValues>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: session?.user?.email ?? '', password: '' },
  });

  const onSubmitXC = async (values: XCValues): Promise<void> => {
    if (inFlightRef.current) return;
    if (!isAccountDeletionEnabled()) {
      await authLifecycle.deleteAccountXC(values, { toast });
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setBlockedByReservations(false);
    try {
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
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const initiateGoogleReauth = async (): Promise<void> => {
    if (inFlightRef.current) return;
    if (!isAccountDeletionEnabled()) {
      await authLifecycle.startDeleteAccountGoogleReauth(
        session?.user?.email ?? '',
        { toast }
      );
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    let redirected = false;
    try {
      const result = await authLifecycle.startDeleteAccountGoogleReauth(
        session?.user?.email ?? '',
        {
          navigate: (url) => router.push(url),
          toast,
        }
      );
      redirected = result.ok;
    } finally {
      inFlightRef.current = false;
      if (!redirected) {
        setIsSubmitting(false);
      }
    }
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
