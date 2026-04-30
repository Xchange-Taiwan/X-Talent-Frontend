import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { DeleteAccountXCSchema } from '@/schemas/auth';
import { deleteAccount } from '@/services/auth/deleteAccount';
import { getGoogleAuthorizeLoginUrl } from '@/services/auth/googleAuthorize';

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
  const [blockedByReservations, setBlockedByReservations] = useState(false);

  const mode: DeleteAccountMode =
    session?.user?.provider === 'custom-google-token' ? 'google' : 'xc';

  const xcForm = useForm<XCValues>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: session?.user?.email ?? '', password: '' },
  });

  const onSubmitXC = async (values: XCValues): Promise<void> => {
    setIsSubmitting(true);
    setBlockedByReservations(false);
    try {
      const result = await deleteAccount({
        email: values.email,
        password: values.password,
      });

      if (result.status === 'success') {
        trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
        if (session?.user?.id) {
          await revalidateProfilePath(String(session.user.id));
        }
        await signOut({ callbackUrl: '/' });
        return;
      }

      if (result.status === 'blocked_reservations') {
        setBlockedByReservations(true);
        return;
      }

      captureFlowFailure({
        flow: 'delete_account',
        step: 'submit',
        message: result.message,
      });
      toast({
        variant: 'destructive',
        description: result.message || '刪除帳號失敗，請稍後再試',
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateGoogleReauth = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      sessionStorage.setItem(
        'delete_account_email',
        session?.user?.email ?? ''
      );
      const { authorization_url } = await getGoogleAuthorizeLoginUrl();
      router.push(authorization_url);
    } catch {
      sessionStorage.removeItem('delete_account_email');
      toast({
        variant: 'destructive',
        description: '無法取得 Google 授權連結，請稍後再試',
        duration: 3000,
      });
      setIsSubmitting(false);
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
