'use client';

import Image from 'next/image';
import { FC, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { groupAsPlaceholderCategories } from '@/lib/profile/categoryGrouping';
import { cn } from '@/lib/utils';
import { InterestVO } from '@/services/profile/interests';

import { GroupedSelections } from './GroupedSelections';
import { step5Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step5Schema>>>;
  topicOptions: InterestVO[];
}

export const TopicsToDiscuss: FC<Props> = ({ form, topicOptions }) => {
  const categories = groupAsPlaceholderCategories(topicOptions);
  const optionMap = useMemo(() => {
    const map = new Map<string, InterestVO>();
    topicOptions.forEach((t) => map.set(t.subject_group, t));
    return map;
  }, [topicOptions]);

  return (
    <FormField
      control={form.control}
      name="topics"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <GroupedSelections
              categories={categories}
              value={field.value ?? []}
              onChange={field.onChange}
              maxSelected={10}
              layoutClass="grid grid-cols-1 gap-4"
              renderItem={(opt, { checked, disabled, onToggle }) => {
                const meta = optionMap.get(opt.value);
                const icon = meta?.desc?.icon;
                const desc = meta?.desc?.desc;
                return (
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-4 rounded-xl border px-4 py-3',
                      checked
                        ? 'border-primary bg-secondary'
                        : 'border-gray-200',
                      disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <div className="rounded-full bg-[#EBFBFB] p-3">
                      {icon && (
                        <Image
                          src={icon}
                          alt={desc ?? '主題圖示'}
                          width={24}
                          height={24}
                          sizes="24px"
                          className="object-contain"
                        />
                      )}
                    </div>
                    <div className="grow">
                      <p className="text-base font-normal text-text-primary">
                        {opt.label}
                      </p>
                      {desc && (
                        <p className="text-sm text-text-tertiary">{desc}</p>
                      )}
                    </div>
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={onToggle}
                      className="mt-1"
                    />
                  </label>
                );
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
