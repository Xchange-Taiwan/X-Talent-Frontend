'use client';

import { FC, ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  ApartmentSolid,
  BiotechSolid,
  FilePresentSolid,
  Groups2Solid,
  HandShakeSolid,
} from '@/components/Icon';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

import { talkTopicEnum, talkTopicOptions } from './constant';
import { formSchema } from './index';

const mapForTalkTopicAndIcon: {
  [key in talkTopicEnum]: ReactElement;
} = {
  [talkTopicEnum.INDUSTRY_KNOWLEDGE]: <BiotechSolid />,
  [talkTopicEnum.COMPANY_CULTURE_OPPORTUNITIES]: <ApartmentSolid />,
  [talkTopicEnum.RESUME_CHECKUP]: <FilePresentSolid />,
  [talkTopicEnum.JOB_SEEKING_EXPERIENCE_SHARING]: <HandShakeSolid />,
  [talkTopicEnum.MOCK_INTERVIEW]: <Groups2Solid />,
  [talkTopicEnum.JOB_POSITION_EXPERTISE]: <BiotechSolid />,
};

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const Step4: FC<Props> = ({ form }) => {
  return (
    <div className="min-h-[calc(60vh)]">
      <p className="mb-10 text-center text-xl font-bold">
        你想聊聊哪方面的主題？
      </p>

      <div className="grid grid-cols-2 gap-4">
        {talkTopicOptions.map((option) => (
          <FormField
            key={option.value}
            control={form.control}
            name="talkTopic"
            render={({ field }) => {
              return (
                <FormItem key={option.value}>
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
                        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-gray-200 px-3 py-6 text-center',
                        field.value.includes(option.value) &&
                          'border-primary bg-secondary',
                      )}
                    >
                      <div className="rounded-full bg-[#EBFBFB] p-4">
                        {mapForTalkTopicAndIcon[option.value]}
                      </div>

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
