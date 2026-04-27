'use client';

import { useSession } from 'next-auth/react';
import { FC, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

import AvatarUpload from '@/components/ui/avatar-upload';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { step1Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step1Schema>>>;
  avatarError?: string | null;
}

export const WhoAreYou: FC<Props> = ({ form, avatarError }) => {
  const watchedAvatar = useWatch({ control: form.control, name: 'avatar' });
  const { data: session } = useSession();
  const stableCacheBust = useRef(Date.now()).current;
  const avatarDisplayUrl = watchedAvatar
    ? `${watchedAvatar}?cb=${session?.user?.avatarUpdatedAt ?? stableCacheBust}`
    : '';

  return (
    <>
      <AvatarUpload
        control={form.control}
        name="avatarFile"
        avatarUrl={avatarDisplayUrl}
      />
      {avatarError && (
        <p className="-mt-6 text-center text-sm font-medium text-destructive lg:text-left">
          {avatarError}
        </p>
      )}

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel showErrorStyle={false}>輸入姓名</FormLabel>

            <FormControl>
              <Input placeholder="請填入您的姓名" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
