import Link from 'next/link';
import { Control } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormMessage } from '@/components/ui/form';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import { SignUpSchema } from '@/schemas/auth';

const TERMS_LINK_CLASSES = cn(
  'text-brand-500 cursor-pointer rounded-sm text-sm underline',
  FOCUS_RING_CLASSES
);

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
              className={TERMS_LINK_CLASSES}
            >
              隱私權政策
            </Link>
            和
            <Link
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className={TERMS_LINK_CLASSES}
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
