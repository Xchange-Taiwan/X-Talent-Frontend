import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from './button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from './input';

const meta: Meta<typeof Form> = {
  title: 'Components/UI/Form',
  component: Form,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Form>;

interface FormValues {
  username: string;
  email: string;
}

const FormDemo = () => {
  const form = useForm<FormValues>({
    defaultValues: {
      username: '',
      email: '',
    },
  });

  const onSubmit = (data: FormValues) => {
    alert(JSON.stringify(data, null, 2));
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-md space-y-6"
      >
        <FormField
          control={form.control}
          name="username"
          rules={{ required: '請輸入導師姓名' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>導師姓名</FormLabel>
              <FormControl>
                <Input placeholder="例如：林小明" {...field} />
              </FormControl>
              <FormDescription>
                請輸入您在平台上顯示的真實姓名或專業別名。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: '請輸入聯絡信箱',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: '信箱格式不正確',
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>聯絡信箱</FormLabel>
              <FormControl>
                <Input placeholder="例如：mentor@xchange.tw" {...field} />
              </FormControl>
              <FormDescription>
                學員預約成功後，系統將會發送通知至此信箱。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">儲存個人設定</Button>
      </form>
    </Form>
  );
};

export const Default: Story = {
  render: () => <FormDemo />,
};
