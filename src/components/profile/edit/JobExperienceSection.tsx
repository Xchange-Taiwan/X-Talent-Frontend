'use client';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import React from 'react';

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
import { ProfileFormContext } from '@/hooks/user/profile/useEditProfileForm';
import {
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from '@/hooks/user/profile/useRepeatablePeriodSection';

import { Section } from './Section';

interface Props {
  industries: {
    subject: string;
    subject_group: string;
  }[];
  locations: {
    value: string;
    text: string;
  }[];
  form: ProfileFormContext;
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

  const { fields, move, isInvalidPeriod, tryAppend, remove } =
    useRepeatablePeriodSection(
      form,
      {
        arrayName: 'work_experiences',
        periodStartKey: 'job_period_start',
        periodEndKey: 'job_period_end',
        isIncompleteForAppend: (last) =>
          !last?.job ||
          !last?.company ||
          !last?.job_period_start ||
          !last?.job_period_end,
        incompleteAlertMessage: '請先完成上一筆工作經驗再新增',
      },
      onValidationChange
    );

  const setPrimary = (targetIndex: number) => {
    const experiences = getValues('work_experiences') ?? [];
    experiences.forEach((_, i) => {
      setValue(`work_experiences.${i}.is_primary`, i === targetIndex, {
        shouldDirty: true,
      });
    });
  };

  const removeAndReassignPrimary = (index: number) => {
    const experiences = getValues('work_experiences') ?? [];
    const removingPrimary = experiences[index]?.is_primary === true;
    remove(index);

    if (!removingPrimary) return;
    const next = getValues('work_experiences') ?? [];
    if (next.length > 0) {
      setValue(`work_experiences.0.is_primary`, true, { shouldDirty: true });
    }
  };

  const addJob = () => {
    const hasNoExperiences = (getValues('work_experiences') ?? []).length === 0;
    tryAppend({
      id: -1,
      job: '',
      company: '',
      job_period_start: '',
      job_period_end: 'now',
      industry: '',
      job_location: 'TWN',
      description: '',
      is_primary: hasNoExperiences,
    });
  };

  return (
    <Section title="工作經驗" required={isMentor}>
      {fields.map((field, index) => {
        const invalidPeriod = isInvalidPeriod(index);

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
                  <ChevronUpIcon className="size-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDownIcon className="size-5" />
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
                name={`work_experiences.${index}.job_period_start`}
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
                name={`work_experiences.${index}.job_period_end`}
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

            {invalidPeriod && (
              <p className="text-status-error-default mb-4 text-sm font-medium">
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
                  name={`work_experiences.${index}.job_location`}
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
              name={`work_experiences.${index}.is_primary`}
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
                    <TrashIcon className="mr-2 size-5" />
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
        className="text-brand-500 rounded-full px-4 py-3"
        onClick={addJob}
      >
        <PlusIcon className="mr-2 size-5" />
        新增
      </Button>
      {errors.work_experiences?.message && (
        <p className="text-status-error-default mt-2 text-sm font-medium">
          {errors.work_experiences?.message as string}
        </p>
      )}
    </Section>
  );
};
