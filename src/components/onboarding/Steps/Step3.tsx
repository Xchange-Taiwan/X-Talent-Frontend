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

export const Step3: FC<Props> = ({ form }) => {
  return (
    <div className="min-h-[calc(60vh)]">
      <p className="mb-10 text-center text-xl font-bold">你想精進的能力？</p>

      <div className="flex flex-wrap gap-4">
        {skillEnhancementTargetOptions.map((option) => (
          <FormField
            key={option.value}
            control={form.control}
            name="skillEnhancementTarget"
            render={({ field }) => {
              return (
                <FormItem key={option.value} className="basis-[calc(50%-16px)]">
                  <FormControl className="hidden">
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
                  <FormLabel className="m-0 text-base font-normal">
                    <div
                      key={`interestedRole ${option.value}`}
                      className={cn(
                        'cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-center',
                        field.value.includes(option.value) &&
                          'border-primary bg-secondary',
                      )}
                    >
                      {option.text}
                    </div>
                  </FormLabel>
                </FormItem>
              );
            }}
          />
        ))}
      </div>
    </div>
  );
};
