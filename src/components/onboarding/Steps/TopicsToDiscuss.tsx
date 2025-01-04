'use client';

import {
  ArticleOutlined as ArticleOutlinedIcon,
  Business as BusinessIcon,
  ContactMailOutlined as ContactMailOutlinedIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
  SelfImprovement as SelfImprovementIcon,
  WorkOutline as WorkOutlineIcon,
} from '@mui/icons-material';
import { FC, ReactElement } from 'react';
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

import { talkTopicEnum, talkTopicOptions } from './constant';
import { formSchema } from './index';

const TALK_TOPIC_ICON_MAP: {
  [key in keyof typeof talkTopicEnum]: ReactElement;
} = {
  INDUSTRY_KNOWLEDGE: <PrecisionManufacturingIcon />,
  COMPANY_CULTURE_OPPORTUNITIES: <BusinessIcon />,
  RESUME_CHECKUP: <ArticleOutlinedIcon />,
  JOB_SEEKING_EXPERIENCE_SHARING: <WorkOutlineIcon />,
  MOCK_INTERVIEW: <ContactMailOutlinedIcon />,
  JOB_POSITION_EXPERTISE: <SelfImprovementIcon />,
};

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const TopicsToDiscuss: FC<Props> = ({ form }) => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {talkTopicOptions.map((option) => (
          <FormField
            key={option.value}
            control={form.control}
            name="topics"
            render={({ field }) => {
              return (
                <FormItem
                  key={option.value}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border border-gray-200 px-4 py-3',
                    field.value.includes(option.value) &&
                      'border-primary bg-secondary',
                  )}
                >
                  <FormLabel className="flex grow cursor-pointer gap-4 ">
                    <div className="rounded-full bg-[#EBFBFB] p-3">
                      {
                        TALK_TOPIC_ICON_MAP[
                          option.value as keyof typeof TALK_TOPIC_ICON_MAP
                        ]
                      }
                    </div>

                    <div>
                      <p className="text-base font-normal text-text-primary">
                        {option.text}
                      </p>
                      <p className=" text-sm text-text-tertiary">
                        文案待 PM 補上
                      </p>
                    </div>
                  </FormLabel>
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
                </FormItem>
              );
            }}
          />
        ))}
      </div>
    </>
  );
};
