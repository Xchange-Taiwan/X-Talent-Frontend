'use client';

import { PlusIcon } from '@radix-ui/react-icons';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

import { ProfileFormValues } from './profileSchema';
import { Section } from './section';

interface Props {
  form: UseFormReturn<ProfileFormValues>;
}

/**
 * Job experience section component
 * - Keeps labels and layout consistent with original design
 */
export const JobExperienceSection = ({ form }: Props) => (
  <Section title="工作經驗">
    {/* Title & Company */}
    <div className="mb-6 gap-6 md:flex">
      <FormField
        control={form.control}
        name="job"
        render={({ field }) => (
          <FormItem className="mb-4 grow md:mb-0">
            <FormLabel>職稱</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="company"
        render={({ field }) => (
          <FormItem className="grow">
            <FormLabel>公司名稱</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    {/* Period */}
    <div className="mb-6 gap-2 md:flex">
      <FormField
        control={form.control}
        name="jobPeriodStart"
        render={({ field }) => (
          <FormItem className="mb-4 grow basis-1/2 md:mb-0">
            <FormLabel>開始年份</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={String(field.value ?? '')}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇年份" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <p className="relative bottom-[-8px] mx-2 my-auto hidden text-center md:block">
        ～
      </p>
      <p className="relative bottom-[-8px] mx-2 my-auto text-center text-sm md:hidden">
        至
      </p>
      <FormField
        control={form.control}
        name="jobPeriodEnd"
        render={({ field }) => (
          <FormItem className="grow basis-1/2">
            <FormLabel className="invisible md:visible">&nbsp;</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={String(field.value ?? '')}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="至今" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="now">至今</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    {/* Industry & Location */}
    <div className="mb-6 gap-6 md:flex">
      <FormField
        control={form.control}
        name="industry"
        render={({ field }) => (
          <FormItem className="mb-4 grow basis-1/2 md:mb-0">
            <FormLabel>產業</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={String(field.value ?? '')}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="請填入您的產業" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="金融業">金融業</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobLocation"
        render={({ field }) => (
          <FormItem className="grow basis-1/2">
            <FormLabel>地點</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={String(field.value ?? '')}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="請填入您的地點" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="台北">台北</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    {/* Description */}
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem className="mb-6">
          <FormLabel>描述</FormLabel>
          <FormControl>
            <Textarea {...field} className="h-24" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <Button variant="ghost" className="rounded-full px-4 py-3 text-brand-500">
      <PlusIcon className="mr-2 h-5 w-5" />
      新增
    </Button>
  </Section>
);
