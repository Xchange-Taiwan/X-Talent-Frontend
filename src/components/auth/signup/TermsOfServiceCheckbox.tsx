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
        <div className="flex items-center space-y-0 space-x-3">
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          <span className="text-text-secondary text-sm leading-none font-medium">
            我同意 X-Talent{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 cursor-pointer text-sm underline"
            >
              隱私權政策
            </Link>
            和
            <Link
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 cursor-pointer text-sm underline"
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
