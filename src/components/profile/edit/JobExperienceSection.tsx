'use client';

import { PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import React from 'react';

import { ConfirmDialog } from '@/components/profile/edit/ConfirmDialog';
import { ExperienceReorderHeader } from '@/components/profile/edit/ExperienceReorderHeader';
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
import type { OnboardingFormContext } from '@/hooks/user/onboarding/useOnboardingForm';
import { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from '@/hooks/user/profile/useRepeatablePeriodSection';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { ProfileFormValues } from '@/schemas/profileSchema';

import { Section } from './Section';

type VerifyWorkExperienceContract =
  NonNullable<
    OnboardingFormValues['work_experiences']
  > extends ProfileFormValues['work_experiences']
    ? ProfileFormContext | OnboardingFormContext
    : never;

interface Props {
  industries: {
    subject: string;
    subject_group: string;
  }[];
  locations: {
    value: string;
    text: string;
  }[];
  form: VerifyWorkExperienceContract;
  isMentor: boolean;
}

export const JobExperienceSection = ({
  industries,
  locations,
  form: rawForm,
  isMentor,
}: Props) => {
  const form = rawForm as ProfileFormContext;
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = form;

  const { fields, move, tryAppend, remove, createPeriodChangeHandlers } =
    useRepeatablePeriodSection(form, {
      arrayName: 'work_experiences',
      isIncompleteForAppend: (last) =>
        !last?.job ||
        !last?.company ||
        !last?.job_period_start ||
        !last?.job_period_end,
      incompleteAlertMessage: '請先完成上一筆工作經驗再新增',
    });

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
    <Section
      title="工作經驗"
      required={isMentor}
      optional={!isMentor}
      subtitle={
        isMentor ? '補充與專業相關的工作經歷。建議至少 1 筆。' : undefined
      }
      variant="option-a"
    >
      {isMentor && fields.length === 0 && (
        <p className="text-text-tertiary mb-4 text-sm">
          請新增至少一項工作經歷
        </p>
      )}
      {fields.map((field, index) => {
        const { handleStartYearChange, handleEndYearChange } =
          createPeriodChangeHandlers(index);
        const canRemove = !isMentor || fields.length > 1;

        return (
          <div key={field.id} className="mb-4 rounded-xl border p-5">
            <ExperienceReorderHeader
              index={index}
              total={fields.length}
              itemLabel="工作經驗"
              onMove={move}
            />
            {/* Title & Company */}
            <div className="mb-6 gap-6 md:flex">
              <FormField
                control={control}
                name={`work_experiences.${index}.job`}
                render={({ field }) => (
                  <FormItem className="mb-4 grow md:mb-0">
                    <FormLabel>職稱</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例如：前端工程師"
                        className="focus-visible:ring-offset-0"
                      />
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
                      <Input
                        {...field}
                        placeholder="例如：Startup Studio"
                        className="focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Period */}
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={control}
                name={`work_experiences.${index}.job_period_start`}
                render={({ field }) => (
                  <FormItem className="grow">
                    <FormLabel>開始年份</FormLabel>
                    <Select
                      onValueChange={handleStartYearChange(field.onChange)}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus-visible:ring-offset-0">
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
              <FormField
                control={control}
                name={`work_experiences.${index}.job_period_end`}
                render={({ field }) => (
                  <FormItem className="grow">
                    <FormLabel>結束年份</FormLabel>
                    <Select
                      onValueChange={handleEndYearChange(field.onChange)}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus-visible:ring-offset-0">
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
                    <Textarea
                      {...field}
                      placeholder="例如：負責產品前端介面，與產品及設計團隊協作。"
                      className="h-24 focus-visible:ring-offset-0"
                    />
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
                      className="focus-visible:ring-offset-0"
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

            {canRemove && (
              <ConfirmDialog
                title="要刪除這段工作經驗嗎？"
                description="您確定要移除這個區塊嗎？"
                onConfirm={() => removeAndReassignPrimary(index)}
                trigger={
                  <Button
                    type="button"
                    variant="destructive"
                    className="focus-visible:ring-offset-0"
                  >
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
        type="button"
        variant="ghost"
        className="text-brand-500 rounded-full px-4 py-3 focus-visible:ring-offset-0"
        onClick={addJob}
      >
        <PlusIcon className="mr-2 size-5" />
        新增工作經驗
      </Button>
      {(errors.work_experiences?.message ??
        errors.work_experiences?.root?.message) && (
        <p className="text-status-error-default mt-2 text-sm font-medium">
          {errors.work_experiences?.message ??
            errors.work_experiences?.root?.message}
        </p>
      )}
    </Section>
  );
};
