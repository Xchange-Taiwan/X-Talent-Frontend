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

import { skillEnhancementTargetOptions } from './constant';
import { formSchema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const SkillsToImprove: FC<Props> = ({ form }) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {skillEnhancementTargetOptions.map((option) => (
          <FormField
            key={option.value}
            control={form.control}
            name="skillEnhancementTarget"
            render={({ field }) => {
              return (
                <FormItem
                  key={option.value}
                  className={cn(
                    'flex items-center space-y-0 rounded-xl border border-gray-200 pl-3',
                    field.value.includes(option.value) &&
                      'border-primary bg-secondary',
                  )}
                >
                  <FormControl>
                    <Checkbox
                      checked={field.value?.includes(option.value)}
                      onCheckedChange={(checked) => {
                        return checked
                          ? field.onChange([...field.value, option.value])
                          : field.onChange(
                              field.value?.filter(
                                (value) => value !== option.value,
                              ),
                            );
                      }}
                    />
                  </FormControl>
                  <FormLabel className="grow cursor-pointer px-4 py-3 text-base font-normal">
                    {option.text}
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
