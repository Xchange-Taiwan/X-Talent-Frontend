'use client';

import React from 'react';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ProfileFormContext, ProfileFormValues } from '@/schemas/profileSchema';

import { platformLabelMap } from '../social-links/platformLabelMap';
import { Section } from './Section';

const SOCIAL_LINKS = Object.entries(platformLabelMap).map(([key, value]) => ({
  name: key as keyof ProfileFormValues,
  label: value.label,
  icon: value.icon,
}));

interface Props {
  form: ProfileFormContext;
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
                <div className="mr-3 flex size-5 shrink-0 items-center justify-center">
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
                <p className="text-sm font-medium text-status-error-default">
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
