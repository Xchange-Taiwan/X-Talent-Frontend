'use client';

import { PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import React, { useEffect } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';

import { ConfirmDialog } from '@/components/profile/edit/ConfirmDialog';
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

import { ProfileFormValues } from '../profileSchema';
import { Section } from '../Section';
import { taiwanSchools } from './schoolData';

interface Props {
  form: UseFormReturn<ProfileFormValues>;
  isMentor: boolean;
  onValidationChange: (hasError: boolean) => void;
}

export const EducationSection = ({
  form,
  isMentor,
  onValidationChange,
}: Props) => {
  const {
    control,
    getValues,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'educations',
  });

  const addEducation = () => {
    const educations = getValues('educations');
    const last = educations?.at(-1);
    if (
      educations.length > 0 &&
      (!last?.subject ||
        !last?.school ||
        !last?.educationPeriodStart ||
        !last?.educationPeriodEnd)
    ) {
      alert('請先完成上一筆教育資料再新增');
      return;
    }

    append({
      id: -1,
      subject: '',
      school: '',
      educationPeriodStart: '',
      educationPeriodEnd: '',
    });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1940 + 1 }, (_, i) =>
    (currentYear - i).toString()
  );

  const watchedEducations = useWatch({
    control,
    name: 'educations',
  }) as
    | Array<{
        educationPeriodStart?: string;
        educationPeriodEnd?: string;
      }>
    | undefined;

  useEffect(() => {
    const hasError = watchedEducations?.some((edu) => {
      const start = edu.educationPeriodStart;
      const end = edu.educationPeriodEnd;
      return start && end && end !== 'now' && Number(start) > Number(end);
    });
    onValidationChange(!!hasError);
  }, [watchedEducations, onValidationChange]);

  return (
    <Section
      title={
        <>
          {isMentor && <span className="text-status-200">* </span>}
          教育經歷
        </>
      }
    >
      {fields.map((field, index) => {
        const watched = watchedEducations?.[index] ?? {};
        const start = watched.educationPeriodStart;
        const end = watched.educationPeriodEnd;
        const isInvalidPeriod =
          start && end && end !== 'now' && Number(start) > Number(end);

        return (
          <div key={field.id} className="mb-8 border-b pb-4">
            <div className="mb-6 gap-6 md:flex">
              <FormField
                control={control}
                name={`educations.${index}.subject`}
                render={({ field }) => (
                  <FormItem className="mb-4 grow md:mb-0">
                    <FormLabel>主修</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`educations.${index}.school`}
                render={({ field }) => (
                  <FormItem className="grow">
                    <FormLabel>學校名稱</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇學校" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taiwanSchools.map((school) => (
                          <SelectItem key={school} value={school}>
                            {school}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-2 gap-2 md:flex md:basis-1/2">
              <FormField
                control={control}
                name={`educations.${index}.educationPeriodStart`}
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
                name={`educations.${index}.educationPeriodEnd`}
                render={({ field }) => (
                  <FormItem className="grow basis-1/2">
                    <FormLabel className="invisible md:visible">
                      &nbsp;
                    </FormLabel>
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

            {isInvalidPeriod && (
              <p className="mb-4 text-sm font-medium text-status-200">
                開始年份不可大於結束年份
              </p>
            )}

            {fields.length > 1 && (
              <ConfirmDialog
                title="要刪除這筆學歷嗎?"
                description="您確定要移除這個區塊嗎?"
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
        );
      })}

      <Button
        variant="ghost"
        className="rounded-full px-4 py-3 text-brand-500"
        onClick={addEducation}
      >
        <PlusIcon className="mr-2 h-5 w-5" />
        新增
      </Button>
      {errors.educations?.message && (
        <p className="mt-2 text-sm font-medium text-destructive">
          {errors.educations?.message as string}
        </p>
      )}
    </Section>
  );
};
