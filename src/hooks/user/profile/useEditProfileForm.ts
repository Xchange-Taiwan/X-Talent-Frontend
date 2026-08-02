'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormInput,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export type ProfileFormContext = UseFormReturn<
  ProfileFormInput,
  any,
  ProfileFormValues
>;

export function useEditProfileForm(isMentor: boolean): {
  form: ProfileFormContext;
} {
  const resolver = useMemo(() => {
    return zodResolver(createProfileFormSchema(isMentor));
  }, [isMentor]);

  const form = useForm<ProfileFormInput, any, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
