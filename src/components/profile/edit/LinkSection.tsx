'use client';

import React from 'react';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { OnboardingFormContext } from '@/hooks/user/onboarding/useOnboardingForm';
import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import { SOCIAL_PLATFORM_KEYS } from '@/lib/profile/socialLinks';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { ProfileFormValues } from '@/schemas/profileSchema';

import { platformLabelMap } from '../social-links/platformLabelMap';
import { Section } from './Section';

type VerifyLinksContract =
  NonNullable<OnboardingFormValues['links']> extends ProfileFormValues['links']
    ? ProfileFormContext | OnboardingFormContext
    : never;

const SOCIAL_LINKS = SOCIAL_PLATFORM_KEYS.map((platform) => ({
  platform,
  label: platformLabelMap[platform].label,
  placeholder: platformLabelMap[platform].placeholder,
  icon: platformLabelMap[platform].icon,
}));

interface Props {
  id?: string;
  form: VerifyLinksContract;
}

export const LinksSection = ({ id = 'links', form: rawForm }: Props) => {
  const form = rawForm as ProfileFormContext;
  return (
    <Section id={id} title="個人連結" optional variant="option-a">
      <div className="grid grid-cols-1 gap-5">
        {SOCIAL_LINKS.map(({ platform, label, placeholder, icon }) => (
          <FormField
            key={platform}
            control={form.control}
            name={`links.${platform}`}
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-text-primary text-sm font-medium">
                  {label}
                </FormLabel>
                <div className="flex items-center p-0.5">
                  <div
                    aria-hidden="true"
                    className="mr-3 flex size-5 shrink-0 items-center justify-center"
                  >
                    {icon}
                  </div>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={placeholder}
                      className="min-h-[44px] rounded-lg focus-visible:ring-offset-0"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
    </Section>
  );
};
