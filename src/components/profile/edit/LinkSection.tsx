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
import { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import { SOCIAL_PLATFORM_KEYS } from '@/lib/profile/socialLinks';

import { platformLabelMap } from '../social-links/platformLabelMap';
import { Section } from './Section';

const SOCIAL_LINKS = SOCIAL_PLATFORM_KEYS.map((platform) => ({
  platform,
  label: platformLabelMap[platform].label,
  icon: platformLabelMap[platform].icon,
}));

interface Props {
  id?: string;
  form: ProfileFormContext;
  cardVariant?: boolean;
  subtitle?: string;
}

export const LinksSection = ({
  id = 'links',
  form,
  cardVariant = false,
  subtitle = '選填；需為該平台的網址',
}: Props) => {
  const fieldsList = SOCIAL_LINKS.map(({ platform, label, icon }) => (
    <FormField
      key={platform}
      control={form.control}
      name={`links.${platform}`}
      render={({ field }) => (
        <FormItem className="mb-4 last:mb-0">
          <FormLabel>
            <div className="flex items-center gap-2">
              {icon}
              <span>{label}</span>
            </div>
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              inputMode="url"
              placeholder=""
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  ));

  if (cardVariant) {
    return (
      <section
        id={id}
        data-testid="mentee-section-links"
        className="border-background-border bg-background-white rounded-2xl border p-6 shadow-sm"
      >
        <div className="mb-5">
          <h2 className="text-text-primary text-xl font-bold">個人連結</h2>
          {subtitle && (
            <p className="text-text-tertiary mt-1 text-sm">{subtitle}</p>
          )}
        </div>
        <div>{fieldsList}</div>
      </section>
    );
  }

  return (
    <Section id={id} title="個人連結">
      {fieldsList}
    </Section>
  );
};
