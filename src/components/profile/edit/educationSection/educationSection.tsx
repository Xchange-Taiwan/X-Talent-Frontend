'use client';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Check, ChevronsUpDown } from 'lucide-react';
import React, { useState } from 'react';
import { useWatch } from 'react-hook-form';

import { ConfirmDialog } from '@/components/profile/edit/ConfirmDialog';
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
import { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  formatPeriodRangeLabel,
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from '@/hooks/user/profile/useRepeatablePeriodSection';
import { hasExactMatch, searchSchools } from '@/lib/profile/searchSchools';
import { cn } from '@/lib/utils';

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
              className="w-full justify-between font-normal"
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
  form: ProfileFormContext;
  isMentor: boolean;
  collapsible?: boolean;
  cardVariant?: boolean;
}

export const EducationSection = ({
  form,
  isMentor,
  collapsible = false,
  cardVariant = false,
}: Props) => {
  const {
    control,
    formState: { errors },
  } = form;

  const {
    fields,
    move,
    tryAppend,
    remove,
    createPeriodChangeHandlers,
    toggleExpand,
    isRowExpanded,
    hasRowError,
  } = useRepeatablePeriodSection(form, {
    arrayName: 'educations',
    collapsible,
    isIncompleteForAppend: (last) =>
      !last?.subject ||
      !last?.school ||
      !last?.education_period_start ||
      !last?.education_period_end,
    incompleteAlertMessage: '請先完成上一筆教育資料再新增',
  });

  const watchedEducations = useWatch({
    control,
    name: 'educations',
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

  const canRemoveRow = !isMentor || fields.length > 1;

  const renderRows = () => (
    <>
      {fields.map((field, index) => {
        const { handleStartYearChange, handleEndYearChange } =
          createPeriodChangeHandlers(index);
        const currentItem = watchedEducations?.[index] ?? field;
        const isExpanded = isRowExpanded(field.id);
        const rowError = hasRowError(index);
        const schoolInitial = currentItem?.school?.trim()?.charAt(0) || '?';

        return (
          <div
            key={field.id}
            className={cn(
              'mb-4 rounded-xl border p-4',
              rowError
                ? 'border-status-error-default'
                : 'border-background-border'
            )}
          >
            {collapsible && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-background-bottom text-text-primary flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
                    {schoolInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="text-text-primary font-semibold break-words">
                      {currentItem?.school?.trim() || '（未填學校）'}
                    </p>
                    <p className="text-text-tertiary text-sm break-words">
                      {currentItem?.subject?.trim() || '（未填主修）'} ·{' '}
                      {formatPeriodRangeLabel(
                        currentItem?.education_period_start,
                        currentItem?.education_period_end
                      )}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleExpand(field.id)}
                  className="shrink-0"
                >
                  {isExpanded ? '收合' : '編輯'}
                </Button>
              </div>
            )}

            <div
              hidden={collapsible && !isExpanded}
              className={cn(
                collapsible && 'border-background-border mt-4 border-t pt-4',
                collapsible && !isExpanded && 'hidden'
              )}
            >
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
                  render={({ field }) => <SchoolComboboxField field={field} />}
                />
              </div>

              <div className="mb-2 gap-2 md:flex md:basis-1/2">
                <FormField
                  control={control}
                  name={`educations.${index}.education_period_start`}
                  render={({ field }) => (
                    <FormItem className="mb-4 grow basis-1/2 md:mb-0">
                      <FormLabel>開始年份</FormLabel>
                      <Select
                        onValueChange={handleStartYearChange(field.onChange)}
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
                <p className="relative bottom-[-8px] mx-2 my-auto hidden text-center md:block">
                  ～
                </p>
                <p className="relative bottom-[-8px] mx-2 my-auto text-center text-sm md:hidden">
                  至
                </p>
                <FormField
                  control={control}
                  name={`educations.${index}.education_period_end`}
                  render={({ field }) => (
                    <FormItem className="grow basis-1/2">
                      <FormLabel className="invisible md:visible">
                        &nbsp;
                      </FormLabel>
                      <Select
                        onValueChange={handleEndYearChange(field.onChange)}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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

              {canRemoveRow && (
                <ConfirmDialog
                  title="要刪除這筆學歷嗎?"
                  description="您確定要移除這個區塊嗎?"
                  onConfirm={() => remove(index)}
                  trigger={
                    <Button type="button" variant="destructive">
                      <TrashIcon className="mr-2 size-5" />
                      移除
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        );
      })}

      {!cardVariant && (
        <Button
          type="button"
          variant="ghost"
          className="text-brand-500 rounded-full px-4 py-3"
          onClick={addEducation}
        >
          <PlusIcon className="mr-2 size-5" />
          新增
        </Button>
      )}
      {(errors.educations?.message ?? errors.educations?.root?.message) && (
        <p className="text-status-error-default mt-2 text-sm font-medium">
          {errors.educations?.message ?? errors.educations?.root?.message}
        </p>
      )}
    </>
  );

  return (
    <Section
      title={cardVariant ? '教育' : '教育經歷'}
      required={isMentor}
      variant={cardVariant ? 'card' : 'default'}
      dataTestId={cardVariant ? 'mentee-section-education' : undefined}
      headerAction={
        cardVariant ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEducation}
            className="shrink-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            新增
          </Button>
        ) : undefined
      }
    >
      {cardVariant && fields.length === 0 && (
        <p className="text-text-tertiary py-2 text-sm">尚未新增教育經歷</p>
      )}
      {renderRows()}
    </Section>
  );
};
