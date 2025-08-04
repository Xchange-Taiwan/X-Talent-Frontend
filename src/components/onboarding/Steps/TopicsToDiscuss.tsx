'use client';

import Image from 'next/image';
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { InterestType } from '@/services/profile/interests';

import { step5Schema } from './index';

const DEFAULT_ICON = 'https://via.placeholder.com/40';
const DEFAULT_ALT = 'DEFAULT_ICON';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step5Schema>>>;
  topicOptions: InterestType[];
}

export const TopicsToDiscuss: FC<Props> = ({ form, topicOptions }) => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {topicOptions.map((option) => (
          <FormField
            key={option.subject_group}
            control={form.control}
            name="topics"
            render={({ field }) => {
              return (
                <FormItem
                  key={option.subject_group}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border border-gray-200 px-4 py-3',
                    field.value.includes(option.subject_group) &&
                      'border-primary bg-secondary'
                  )}
                >
                  <FormLabel className="flex grow cursor-pointer gap-4 ">
                    <div className="rounded-full bg-[#EBFBFB] p-3">
                      <Image
                        src={option.desc.icon || DEFAULT_ICON}
                        alt={option.desc.desc || DEFAULT_ALT}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>

                    <div>
                      <p className="text-base font-normal text-text-primary">
                        {option.subject}
                      </p>
                      <p className=" text-sm text-text-tertiary">
                        {option.desc.desc}
                      </p>
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Checkbox
                      checked={field.value?.includes(option.subject_group)}
                      onCheckedChange={(checked) => {
                        return checked
                          ? field.onChange([
                              ...field.value,
                              option.subject_group,
                            ])
                          : field.onChange(
                              field.value?.filter(
                                (value) => value !== option.subject_group
                              )
                            );
                      }}
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />
        ))}
      </div>
      <div className="ml-1 mt-3">
        <FormField
          control={form.control}
          name="topics"
          render={() => {
            return (
              <FormItem>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </>
  );
};
