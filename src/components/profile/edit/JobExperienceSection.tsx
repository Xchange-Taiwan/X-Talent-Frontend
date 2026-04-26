'use client';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import React, { useEffect } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';

import { ConfirmDialog } from '@/components/profile/edit/ConfirmDialog';
import { SelectField } from '@/components/profile/edit/Fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Section } from './Section';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1940 + 1 }, (_, i) =>
  (CURRENT_YEAR - i).toString()
);

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
  isMentor: boolean;
  onValidationChange: (hasError: boolean) => void;
}

export const JobExperienceSection = ({
  industries,
  locations,
  form,
  isMentor,
  onValidationChange,
}: Props) => {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = form;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'work_experiences',
  });

  const setPrimary = (targetIndex: number) => {
    const experiences = getValues('work_experiences') ?? [];
    experiences.forEach((_, i) => {
      setValue(`work_experiences.${i}.isPrimary`, i === targetIndex, {
        shouldDirty: true,
      });
    });
  };

  const removeAndReassignPrimary = (index: number) => {
    const experiences = getValues('work_experiences') ?? [];
    const removingPrimary = experiences[index]?.isPrimary === true;
    remove(index);

    if (!removingPrimary) return;
    const next = getValues('work_experiences') ?? [];
    if (next.length > 0) {
      setValue(`work_experiences.0.isPrimary`, true, { shouldDirty: true });
    }
  };

  const watchedExperiences = useWatch({
    control,
    name: 'work_experiences',
  }) as
    | Array<{
        jobPeriodStart?: string;
        jobPeriodEnd?: string;
      }>
    | undefined;

  useEffect(() => {
    const hasError = watchedExperiences?.some((exp) => {
      const start = exp.jobPeriodStart;
      const end = exp.jobPeriodEnd;
      return start && end && end !== 'now' && Number(start) > Number(end);
    });
    onValidationChange(!!hasError);
  }, [watchedExperiences, onValidationChange]);

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
      jobPeriodEnd: 'now',
      industry: '',
      jobLocation: 'TWN',
      description: '',
      isPrimary: experiences.length === 0,
    });
  };

  return (
    <Section
      title={
        <>
          {isMentor && <span className="text-status-200">* </span>}
          工作經驗
        </>
      }
    >
      {fields.map((field, index) => {
        const watched = watchedExperiences?.[index] ?? {};
        const start = watched.jobPeriodStart;
        const end = watched.jobPeriodEnd;
        const isInvalidPeriod =
          start && end && end !== 'now' && Number(start) > Number(end);

        return (
          <div key={field.id} className="mb-4 rounded-lg border p-4">
            {fields.length > 1 && (
              <div className="mb-4 flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUpIcon className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </Button>
              </div>
            )}
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
            <div className="mb-2 gap-2 md:flex">
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
                        {YEAR_OPTIONS.map((year) => (
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
              <p className="relative -bottom-3 my-auto hidden text-center md:block">
                ～
              </p>
              <p className="relative -bottom-3 my-auto text-center text-sm md:hidden">
                至
              </p>
              <FormField
                control={control}
                name={`work_experiences.${index}.jobPeriodEnd`}
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
                          <SelectValue placeholder="至今" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="now">至今</SelectItem>
                        {YEAR_OPTIONS.map((year) => (
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

            {/* Primary toggle */}
            <FormField
              control={control}
              name={`work_experiences.${index}.isPrimary`}
              render={({ field }) => (
                <FormItem className="mb-6 flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => {
                        if (checked) setPrimary(index);
                        else field.onChange(false);
                      }}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-sm font-normal">
                    設為頁面顯示的職稱
                  </FormLabel>
                </FormItem>
              )}
            />

            {fields.length > 1 && (
              <ConfirmDialog
                title="要刪除這段工作經驗嗎？"
                description="您確定要移除這個區塊嗎？"
                onConfirm={() => removeAndReassignPrimary(index)}
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
        onClick={addJob}
      >
        <PlusIcon className="mr-2 h-5 w-5" />
        新增
      </Button>
      {errors.work_experiences?.message && (
        <p className="mt-2 text-sm font-medium text-destructive">
          {errors.work_experiences?.message as string}
        </p>
      )}
    </Section>
  );
};
