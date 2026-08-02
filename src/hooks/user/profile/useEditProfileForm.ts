'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export type ProfileFormContext = UseFormReturn<ProfileFormValues>;

export function useEditProfileForm(isMentor: boolean): {
  form: ProfileFormContext;
} {
  const resolver = useMemo(() => {
    return zodResolver(createProfileFormSchema(isMentor));
  }, [isMentor]);

  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues: defaultValues as unknown as ProfileFormValues,
  });

  return { form };
}
