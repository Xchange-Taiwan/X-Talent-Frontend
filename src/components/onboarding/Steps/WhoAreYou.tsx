'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import AvatarUpload from '@/components/ui/avatarUpload';
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
  avatarUrl: string;
}

export const WhoAreYou: FC<Props> = ({ form, avatarUrl }) => {
  return (
    <>
      <AvatarUpload
        control={form.control}
        name="avatarFile"
        maxSize={2 * 1024 * 1024}
        avatarUrl={avatarUrl}
      />

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
