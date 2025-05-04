'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { ProfileFormValues } from './profileSchema';
import { Section } from './section';

const SOCIAL_LINKS: Array<{
  name: keyof ProfileFormValues;
  label: string;
  icon: string;
}> = [
  {
    name: 'linkedin',
    label: 'LinkedIn',
    icon: '/profile/edit/linkedin-logo.svg',
  },
  {
    name: 'facebook',
    label: 'Facebook',
    icon: '/profile/edit/facebook-logo.svg',
  },
  {
    name: 'instagram',
    label: 'Instagram',
    icon: '/profile/edit/instagram-logo.svg',
  },
  {
    name: 'twitter',
    label: 'X (formerly Twitter)',
    icon: '/profile/edit/twitter-logo.svg',
  },
  { name: 'youtube', label: 'YouTube', icon: '/profile/edit/youtube-logo.svg' },
  {
    name: 'website',
    label: '個人網站',
    icon: '/profile/edit/website-logo.svg',
  },
];

interface Props {
  form: UseFormReturn<ProfileFormValues>;
}

/**
 * Links section component
 * - Renders input fields for social and website links
 */
export const LinksSection = ({ form }: Props) => (
  <Section title="個人連結">
    {SOCIAL_LINKS.map(({ name, label, icon }) => (
      <FormField
        key={name}
        control={form.control}
        name={name}
        render={({ field }) => {
          // Ensure the input value is a string to satisfy InputProps
          const value = typeof field.value === 'string' ? field.value : '';
          return (
            <FormItem className="mb-4">
              <FormLabel>{label}</FormLabel>
              <div className="flex items-center">
                <div
                  className="mr-3 h-5 w-5 bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url('${icon}')` }}
                />
                <FormControl>
                  <Input
                    placeholder="請填入您的連結"
                    value={value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="!m-auto"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    ))}
  </Section>
);
