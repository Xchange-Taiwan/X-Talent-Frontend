import Link from 'next/link';
import { Control } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormMessage } from '@/components/ui/form';
import { SignUpSchema } from '@/schemas/auth';

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
          <span className="text-sm font-medium leading-none text-text-secondary">
            我同意 X-Talent{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-sm text-brand-500 underline"
            >
              隱私權政策
            </Link>
            和
            <Link
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-sm text-brand-500 underline"
            >
              服務條款
            </Link>
          </span>
          <FormMessage />
        </div>
      )}
    />
  );
}
