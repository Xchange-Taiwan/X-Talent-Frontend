'use client';

import ImageIcon from '@mui/icons-material/ImageOutlined';
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { formSchema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const WhoAreYou: FC<Props> = ({ form }) => {
  const handleUploadAvatar = () => {
    alert('TODO: upload avatar');
  };

  return (
    <>
      <div className="mb-10 flex">
        <div
          className="cursor-pointer rounded-full border-2 border-[#B7CBCB] bg-[#F4FCFC] p-10"
          onClick={handleUploadAvatar}
        >
          <ImageIcon sx={{ fontSize: 80, color: '#B7CBCB' }} />
        </div>
      </div>

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
