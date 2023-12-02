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

import { interestedRoleOptions } from './constant';
import { formSchema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const Step2: FC<Props> = ({ form }) => {
  return (
    <div className="min-h-[calc(60vh)]">
      <p className="mb-10 text-center text-xl font-bold">
        你有興趣的職位或領域？
      </p>

      <div className="flex flex-wrap gap-4">
        {interestedRoleOptions.map((option) => (
          <FormField
            key={option.value}
            control={form.control}
            name="interestedRole"
            render={({ field }) => {
              return (
                <FormItem
                  key={option.value}
                  className="flex flex-row items-start space-x-3 space-y-0"
                >
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
                  <FormLabel className="text-sm font-normal">
                    <div
                      key={`interestedRole ${option.value}`}
                      className={cn(
                        'cursor-pointer rounded-xl border border-gray-200 px-3 py-2',
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
