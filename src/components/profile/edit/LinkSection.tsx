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
}

export const LinksSection = ({ id = 'links', form }: Props) => (
  <Section id={id} title="個人連結">
    {SOCIAL_LINKS.map(({ platform, label, icon }) => (
      <FormField
        key={platform}
        control={form.control}
        name={`links.${platform}`}
        render={({ field }) => (
          <FormItem className="mb-4">
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
    ))}
  </Section>
);
