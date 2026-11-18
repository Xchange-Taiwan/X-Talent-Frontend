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
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

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
}: Props) => (
  <Section
    id={id}
    dataTestId={cardVariant ? 'mentee-section-links' : undefined}
    variant={cardVariant ? 'card' : 'default'}
    title="個人連結"
    subtitle={cardVariant ? subtitle : undefined}
  >
    {SOCIAL_LINKS.map(({ platform, label, icon }) => (
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
                className={
                  cardVariant
                    ? cn(
                        'focus-visible:border-ring',
                        FOCUS_RING_NO_OFFSET_CLASSES
                      )
                    : undefined
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ))}
  </Section>
);
