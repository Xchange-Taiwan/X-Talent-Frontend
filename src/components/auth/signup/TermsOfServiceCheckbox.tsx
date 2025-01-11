import { Control } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormMessage } from '@/components/ui/form';
import { SignUpSchema } from '@/schemas/auth';

import TermsOfServiceDialog from './TermsOfServiceDialog';

interface TermsOfServiceCheckboxProps {
  control: Control<z.infer<typeof SignUpSchema>>;
}

export default function TermsOfServiceCheckbox({
  control,
}: TermsOfServiceCheckboxProps) {
  return (
    <FormField
      control={control}
      name="hasReadTermsOfService"
      render={({ field }) => (
        <div className="flex items-center space-x-3 space-y-0">
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          <span className="text-neutral-600 text-sm font-medium leading-none">
            我同意 <TermsOfServiceDialog control={control} />
          </span>
          <FormMessage />
        </div>
      )}
    />
  );
}
