'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';

import {
  FacebookColor,
  InstagramColor,
  LinkedinColor,
  TwitterColor,
  WebsiteColor,
  YoutubeColor,
} from '@/components/icon';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { ProfileFormValues } from './profileSchema';
import { Section } from './Section';

const SOCIAL_LINKS: Array<{
  name: keyof ProfileFormValues;
  label: string;
  icon: React.ReactElement;
}> = [
  {
    name: 'linkedin',
    label: 'LinkedIn',
    icon: <LinkedinColor className="h-5 w-5" />,
  },
  {
    name: 'facebook',
    label: 'Facebook',
    icon: <FacebookColor className="h-5 w-5" />,
  },
  {
    name: 'instagram',
    label: 'Instagram',
    icon: <InstagramColor className="h-5 w-5" />,
  },
  {
    name: 'twitter',
    label: 'X (formerly Twitter)',
    icon: <TwitterColor className="h-5 w-5" />,
  },
  {
    name: 'youtube',
    label: 'YouTube',
    icon: <YoutubeColor className="h-5 w-5" />,
  },
  {
    name: 'website',
    label: '個人網站',
    icon: <WebsiteColor className="h-5 w-5" />,
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
          const urlErrorMessage = (
            form.formState.errors[name] as
              | { url?: { message?: string } }
              | undefined
          )?.url?.message;

          return (
            <FormItem className="mb-4">
              <FormLabel>{label}</FormLabel>
              <div className="flex items-center">
                <div className="mr-3 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {icon}
                </div>
                <FormControl>
                  <Input
                    placeholder="請填入您的連結"
                    value={field.value?.url || ''}
                    onChange={(e) =>
                      field.onChange({ ...field.value, url: e.target.value })
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="!m-auto"
                  />
                </FormControl>
              </div>
              {urlErrorMessage && (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {urlErrorMessage}
                </p>
              )}
            </FormItem>
          );
        }}
      />
    ))}
  </Section>
);
