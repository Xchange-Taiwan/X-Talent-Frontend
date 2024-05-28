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

export const formSchema = z.object({
  expertise: z.array(
    z.enum(['UI Design', 'UX Design', 'SEO Writing', 'Graphic Design']),
  ),
});

type ExpertiseType =
  | 'UI Design'
  | 'UX Design'
  | 'SEO Writing'
  | 'Graphic Design';
interface Props {
  type: ExpertiseType;
  form?: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
}

export const ExpertiseSelectItem: FC<Props> = ({ form, type }) => {
  const getIconClassName = (type: ExpertiseType) => {
    switch (type) {
      case 'UI Design':
        return "bg-[url('/profile/ui-design.svg')]";
      case 'UX Design':
        return "bg-[url('/profile/ux-design.svg')]";
      case 'SEO Writing':
        return "bg-[url('/profile/seo-writing.svg')]";
      case 'Graphic Design':
        return "bg-[url('/profile/graphic-design.svg')]";
    }
  };

  if (!form) {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-gray-200 px-4 py-3">
        <div className={`h-10 w-10 ${getIconClassName(type)}`}></div>
        <div>
          <p className="text-base font-normal text-text-primary">{type}</p>
          <p className="text-sm text-text-tertiary">文案待 PM 補上</p>
        </div>
      </div>
    );
  }

  return (
    <FormField
      control={form.control}
      name="expertise"
      render={({ field }) => {
        return (
          <FormItem
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200 px-4 py-3',
              'hover:border-primary hover:bg-secondary',
              field.value.includes(type) && 'border-primary bg-secondary',
            )}
          >
            <FormLabel className="flex grow cursor-pointer gap-4">
              <div className={`h-10 w-10 ${getIconClassName(type)}`}></div>
              <div>
                <p className="text-base font-normal text-text-primary">
                  {type}
                </p>
                <p className=" text-sm text-text-tertiary">文案待 PM 補上</p>
              </div>
            </FormLabel>
            <FormControl>
              <Checkbox
                checked={field.value?.includes(type)}
                onCheckedChange={(checked) => {
                  return checked
                    ? field.onChange([...field.value, type])
                    : field.onChange(
                        field.value?.filter((value) => value !== type),
                      );
                }}
              />
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
};
