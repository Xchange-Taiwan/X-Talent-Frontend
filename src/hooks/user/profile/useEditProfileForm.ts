'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormInput,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export type ProfileFormContext = UseFormReturn<
  ProfileFormInput,
  unknown,
  ProfileFormValues
>;

export function useEditProfileForm(isMentor: boolean): {
  form: ProfileFormContext;
} {
  const resolver = useMemo(() => {
    return zodResolver(createProfileFormSchema(isMentor) as z.ZodTypeAny);
  }, [isMentor]);

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
