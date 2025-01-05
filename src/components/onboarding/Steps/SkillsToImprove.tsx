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
  skill: Interest[];
}

export const SkillsToImprove: FC<Props> = ({ form, skill }) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {skill.map((option) => (
          <FormField
            key={option.subject_group}
            control={form.control}
            name="skills"
            render={({ field }) => {
              return (
                <FormItem
                  key={option.subject_group}
                  className={cn(
                    'flex items-center space-y-0 rounded-xl border border-gray-200 pl-3',
                    field.value.includes(option.subject_group) &&
                      'border-primary bg-secondary',
                  )}
                >
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
                                (value) => value !== option.subject_group,
                              ),
                            );
                      }}
                    />
                  </FormControl>
                  <FormLabel className="grow cursor-pointer px-4 py-3 text-base font-normal">
                    {option.subject}
                  </FormLabel>
                </FormItem>
              );
            }}
          />
        ))}
      </div>
    </>
  );
};
