'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Interest } from '@/services/user/interests/interests';

import { formSchema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
  interestedPosition: Interest[];
}

export const InterestedPosition: FC<Props> = ({ form, interestedPosition }) => {
  return (
    <div className="flex flex-wrap gap-3">
      {interestedPosition.map((option) => (
        <FormField
          key={option.subject_group}
          control={form.control}
          name="interested_positions"
          render={({ field }) => {
            return (
              <FormItem
                key={option.subject_group}
                className="flex flex-row items-start space-y-0"
              >
                <FormControl className="hidden">
                  <Checkbox
                    checked={field.value?.includes(option.subject_group)}
                    onCheckedChange={(checked) => {
                      return checked
                        ? field.onChange([...field.value, option.subject_group])
                        : field.onChange(
                            field.value?.filter(
                              (value) => value !== option.subject_group,
                            ),
                          );
                    }}
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">
                  <div
                    key={`interestedRole ${option.subject_group}`}
                    className={cn(
                      'cursor-pointer rounded-xl border border-gray-200 px-3 py-2',
                      field.value.includes(option.subject_group) &&
                        'border-primary bg-secondary',
                    )}
                  >
                    {option.subject}
                  </div>
                </FormLabel>
              </FormItem>
            );
          }}
        />
      ))}
    </div>
  );
};
