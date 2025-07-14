'use client';

import { PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import React from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';

import { ConfirmDialog } from '@/components/profile/edit/confirmDialog';
import { SelectField } from '@/components/profile/edit/fields';
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
  industries: {
    subject: string;
    subject_group: string;
  }[];
  locations: {
    value: string;
    text: string;
  }[];
  form: UseFormReturn<ProfileFormValues>;
}

export const JobExperienceSection = ({
  industries,
  locations,
  form,
}: Props) => {
  const { control, getValues } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'work_experiences',
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1940 + 1 }, (_, i) =>
    (currentYear - i).toString(),
  );

  const addJob = () => {
    const experiences = getValues('work_experiences');
    const last = experiences?.at(-1);
    if (
      experiences.length &&
      (!last?.job ||
        !last?.company ||
        !last?.jobPeriodStart ||
        !last?.jobPeriodEnd)
    ) {
      alert('請先完成上一筆工作經驗再新增');
      return;
    }

    append({
      id: -1,
      job: '',
      company: '',
      jobPeriodStart: '',
      jobPeriodEnd: '',
      industry: '',
      jobLocation: '',
      description: '',
    });
  };

  return (
    <Section title="工作經驗">
      {fields.map((field, index) => (
        <div key={field.id} className="mb-8 border-b pb-4">
          {/* Title & Company */}
          <div className="mb-6 gap-6 md:flex">
            <FormField
              control={control}
              name={`work_experiences.${index}.job`}
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
              control={control}
              name={`work_experiences.${index}.company`}
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
              control={control}
              name={`work_experiences.${index}.jobPeriodStart`}
              render={({ field }) => (
                <FormItem className="mb-4 grow basis-1/2 md:mb-0">
                  <FormLabel>開始年份</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇年份" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
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
              control={control}
              name={`work_experiences.${index}.jobPeriodEnd`}
              render={({ field }) => (
                <FormItem className="grow basis-1/2">
                  <FormLabel className="invisible md:visible">&nbsp;</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="至今" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="now">至今</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Industry & Location */}
          <div className="mb-6 gap-6 md:flex">
            <div className="mb-4 grow basis-1/2 md:mb-0">
              <FormLabel>產業</FormLabel>
              <SelectField
                form={form}
                name={`work_experiences.${index}.industry`}
                placeholder="請選擇產業"
                options={industries.map((i) => ({
                  value: i.subject_group,
                  label: i.subject,
                }))}
              />
            </div>

            <div className="grow basis-1/2">
              <FormLabel>地點</FormLabel>
              <SelectField
                form={form}
                name={`work_experiences.${index}.jobLocation`}
                placeholder="請選擇地區"
                options={locations.map((loc) => ({
                  value: loc.value,
                  label: loc.text,
                }))}
              />
            </div>
          </div>

          {/* Description */}
          <FormField
            control={control}
            name={`work_experiences.${index}.description`}
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

          {fields.length > 1 && (
            <ConfirmDialog
              title="要刪除這段工作經驗嗎？"
              description="您確定要移除這個區塊嗎？"
              onConfirm={() => remove(index)}
              trigger={
                <Button variant="destructive">
                  <TrashIcon className="mr-2 h-5 w-5" />
                  移除
                </Button>
              }
            />
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        className="rounded-full px-4 py-3 text-brand-500"
        onClick={addJob}
      >
        <PlusIcon className="mr-2 h-5 w-5" />
        新增
      </Button>
    </Section>
  );
};
