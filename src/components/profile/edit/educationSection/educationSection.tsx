'use client';

import { PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { Check, ChevronsUpDown } from 'lucide-react';
import React, { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { ConfirmDialog } from '@/components/profile/edit/ConfirmDialog';
import { ExperienceReorderHeader } from '@/components/profile/edit/ExperienceReorderHeader';
import { Button } from '@/components/ui/button';
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from '@/hooks/user/profile/useRepeatablePeriodSection';
import { hasExactMatch, searchSchools } from '@/lib/profile/searchSchools';
import { cn } from '@/lib/utils';
import type { ProfileFormValues } from '@/schemas/profileSchema';

import { Section } from '../Section';
import { taiwanSchools } from './schoolData';

export function SchoolComboboxField({
  field,
}: {
  field: { value: string; onChange: (value: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const trimmedSearch = search.trim();
  const filteredSchools = searchSchools(search, taiwanSchools);
  const isExactMatch = hasExactMatch(search, taiwanSchools);
  const showCreateOption = trimmedSearch.length > 0 && !isExactMatch;

  const selectSchool = (value: string) => {
    field.onChange(value);
    setSearch('');
    setOpen(false);
  };

  return (
    <FormItem className="grow">
      <FormLabel>學校名稱</FormLabel>
      <SearchableSelect
        open={open}
        onOpenChange={(next) => {
          // Closing without an explicit pick (outside click / Escape) discards
          // whatever was typed rather than silently adopting it as the school
          // name — avoids turning a search-in-progress into stored data.
          setSearch('');
          setOpen(next);
        }}
        title="選擇學校"
        searchPlaceholder="搜尋學校..."
        search={search}
        onSearchChange={setSearch}
        trigger={
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal focus-visible:ring-offset-0"
            >
              <span className={cn(!field.value && 'text-text-tertiary')}>
                {field.value || '請選擇學校'}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        }
      >
        <CommandEmpty>找不到相符的學校</CommandEmpty>
        <CommandGroup>
          {filteredSchools.map((school) => (
            <CommandItem key={school} value={school} onSelect={selectSchool}>
              <Check
                className={cn(
                  'mr-2 size-4',
                  field.value === school ? 'opacity-100' : 'opacity-0'
                )}
              />
              {school}
            </CommandItem>
          ))}
          {showCreateOption && (
            <CommandItem
              key="__create_school__"
              value={trimmedSearch}
              onSelect={() => selectSchool(trimmedSearch)}
            >
              <PlusIcon className="mr-2 size-4" />
              新增「{trimmedSearch}」
            </CommandItem>
          )}
        </CommandGroup>
      </SearchableSelect>
      <FormMessage />
    </FormItem>
  );
}

interface Props {
  form: UseFormReturn<ProfileFormValues>;
  isMentor: boolean;
}

export const EducationSection = ({ form, isMentor }: Props) => {
  const {
    control,
    formState: { errors },
  } = form;

  const { fields, move, tryAppend, remove, createPeriodChangeHandlers } =
    useRepeatablePeriodSection(form, {
      arrayName: 'educations',
      isIncompleteForAppend: (last) =>
        !last?.subject ||
        !last?.school ||
        !last?.education_period_start ||
        !last?.education_period_end,
      incompleteAlertMessage: '請先完成上一筆教育資料再新增',
    });

  const addEducation = () => {
    tryAppend({
      id: -1,
      subject: '',
      school: '',
      education_period_start: '',
      education_period_end: 'now',
    });
  };

  return (
    <Section
      title="教育經歷"
      required={isMentor}
      optional={!isMentor}
      subtitle={
        isMentor ? '補充與服務主題相關的背景。建議 1–2 筆。' : undefined
      }
      variant="option-a"
    >
      {isMentor && fields.length === 0 && (
        <p className="text-text-tertiary mb-4 text-sm">
          請新增至少一項教育經歷
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
              itemLabel="教育經歷"
              onMove={move}
            />
            <div className="mb-6 gap-6 md:flex">
              <FormField
                control={control}
                name={`educations.${index}.subject`}
                render={({ field }) => (
                  <FormItem className="mb-4 grow md:mb-0">
                    <FormLabel>主修</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="例如：資訊工程學系"
                        className="focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`educations.${index}.school`}
                render={({ field }) => <SchoolComboboxField field={field} />}
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={control}
                name={`educations.${index}.education_period_start`}
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
                name={`educations.${index}.education_period_end`}
                render={({ field }) => (
                  <FormItem className="grow">
                    <FormLabel>結束年份</FormLabel>
                    <Select
                      onValueChange={handleEndYearChange(field.onChange)}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus-visible:ring-offset-0">
                          <SelectValue placeholder="請選擇年份" />
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

            {canRemove && (
              <ConfirmDialog
                title="要刪除這筆學歷嗎？"
                description="您確定要移除這個區塊嗎？"
                onConfirm={() => remove(index)}
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
        onClick={addEducation}
      >
        <PlusIcon className="mr-2 size-5" />
        新增教育經歷
      </Button>
      {(errors.educations?.message ?? errors.educations?.root?.message) && (
        <p className="text-status-error-default mt-2 text-sm font-medium">
          {errors.educations?.message ?? errors.educations?.root?.message}
        </p>
      )}
    </Section>
  );
};
