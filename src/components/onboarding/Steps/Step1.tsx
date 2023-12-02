'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  industryOptions,
  regionOptions,
  totalWorkSpanOptions,
} from './constant';
import { formSchema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const Step1: FC<Props> = ({ form }) => {
  return (
    <div>
      <p className="mb-10 text-xl font-bold">我的個人資訊</p>

      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>姓名*</FormLabel>
              <FormControl>
                <Input placeholder="請填入您的姓名" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>地區*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請填入您的所在地區" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {regionOptions.map((option) => (
                    <SelectItem
                      key={`region ${option.value}`}
                      value={option.value}
                    >
                      {option.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalWorkSpan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>總年資</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇您的年資區間" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {totalWorkSpanOptions.map((option) => (
                    <SelectItem
                      key={`totalWorkSpan ${option.value}`}
                      value={option.value}
                    >
                      {option.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalWorkSpan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>產業</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇您的產業類別" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {industryOptions.map((option) => (
                    <SelectItem
                      key={`industry ${option.value}`}
                      value={option.value}
                    >
                      {option.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>
                職稱（正職、實習皆可）
              </FormLabel>
              <FormControl>
                <Input placeholder="請填入您的職稱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>
                公司（正職、實習皆可）
              </FormLabel>
              <FormControl>
                <Input placeholder="請填入您的公司名稱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>學校*</FormLabel>
              <FormControl>
                <Input placeholder="請填入您的學校名稱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>LinkedIn 個人檔案</FormLabel>
              <FormControl>
                <Input placeholder="請提供您的個人檔案連結" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
