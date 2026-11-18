'use client';

import { useSession } from 'next-auth/react';
import { useRef } from 'react';
import {
  type Control,
  type FieldValues,
  type Path,
  useWatch,
} from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { withAvatarVersion } from '@/lib/avatar/avatarUrl';

interface WhoAreYouFormFields extends FieldValues {
  name: string;
  avatar?: string;
  avatarFile?: File;
}

interface Props<T extends WhoAreYouFormFields> {
  form: { control: Control<T> };
}

export const WhoAreYou = <T extends WhoAreYouFormFields>({
  form,
}: Props<T>) => {
  const watchedAvatar = useWatch({
    control: form.control,
    name: 'avatar' as Path<T>,
  });
  const { data: session } = useSession();
  const stableCacheBust = useRef(Date.now()).current;
  const avatarDisplayUrl =
    typeof watchedAvatar === 'string' && watchedAvatar
      ? withAvatarVersion(
          watchedAvatar,
          session?.user?.avatarUpdatedAt ?? stableCacheBust,
          'cb'
        )
      : '';

  return (
    <>
      <div data-clarity-mask="true">
        <AvatarUpload
          control={form.control}
          name={'avatarFile' as Path<T>}
          avatarUrl={avatarDisplayUrl}
        />
      </div>

      <FormField
        control={form.control}
        name={'name' as Path<T>}
        render={({ field }) => (
          <FormItem data-clarity-mask="true">
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
