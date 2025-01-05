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
  topic: Interest[];
}

export const TopicsToDiscuss: FC<Props> = ({ form, topic }) => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {topic.map((option) => (
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
                      'border-primary bg-secondary',
                  )}
                >
                  <FormLabel className="flex grow cursor-pointer gap-4 ">
                    <div className="rounded-full bg-[#EBFBFB] p-3">
                      {option.desc.icon}
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
                                (value) => value !== option.subject_group,
                              ),
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
    </>
  );
};
