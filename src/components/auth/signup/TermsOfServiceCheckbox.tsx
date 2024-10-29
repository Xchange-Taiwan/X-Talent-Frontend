import Link from 'next/link';
import React from 'react';
import { Control } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormMessage } from '@/components/ui/form';
import { SignUpSchema } from '@/schemas/auth';

import { linkStyle } from './constants';

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
            我同意{' '}
            <Link className={linkStyle} href="/password/forget">
              X-Talent服務條款
            </Link>
          </span>
          <FormMessage />
        </div>
      )}
    />
  );
}
