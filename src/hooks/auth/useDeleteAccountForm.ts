import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import useAsyncAction from '@/hooks/useAsyncAction';
import {
  executeDeleteAccountXC,
  initiateGoogleDeleteAccountReauth,
} from '@/lib/auth/sessionLifecycle';
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
  const { run, isPending: isSubmitting } = useAsyncAction();
  const [blockedByReservations, setBlockedByReservations] = useState(false);

  const mode: DeleteAccountMode =
    session?.user?.provider === 'custom-google-token' ? 'google' : 'xc';

  const xcForm = useForm<XCValues>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: session?.user?.email ?? '', password: '' },
  });

  const onSubmitXC = async (values: XCValues): Promise<void> => {
    if (process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT !== 'true') {
      toast({
        variant: 'destructive',
        description: '此環境不支援帳號刪除',
        duration: 3000,
      });
      return;
    }

    setBlockedByReservations(false);
    await run(
      async () => {
        const result = await executeDeleteAccountXC(
          {
            email: values.email,
            password: values.password,
          },
          {
            signOut,
            revalidateAfterDelete: revalidateProfilePathAfterDelete,
          }
        );

        if (result.status === 'success') {
          return;
        }

        if (result.status === 'blocked_reservations') {
          setBlockedByReservations(true);
          return;
        }

        throw new Error(result.message || '刪除帳號失敗，請稍後再試');
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'delete_account',
          step: 'submit',
          level: 'info',
        },
        toastOnError: {
          description: (err) =>
            err instanceof Error ? err.message : '刪除帳號失敗，請稍後再試',
          duration: 3000,
        },
      }
    );
  };

  const initiateGoogleReauth = async (): Promise<void> => {
    if (process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT !== 'true') {
      toast({
        variant: 'destructive',
        description: '此環境不支援帳號刪除',
        duration: 3000,
      });
      return;
    }

    await run(
      async () => {
        await initiateGoogleDeleteAccountReauth(session?.user?.email ?? '', {
          navigate: (url) => router.push(url),
        });
      },
      {
        throwError: false,
        toastOnError: {
          description: '無法取得 Google 授權連結，請稍後再試',
          duration: 3000,
        },
      }
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
