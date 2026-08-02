'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Resolver, useForm, UseFormReturn } from 'react-hook-form';

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
    return zodResolver<ReturnType<typeof createProfileFormSchema>>(
      createProfileFormSchema(isMentor)
    );
  }, [isMentor]);

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: resolver as Resolver<
      ProfileFormInput,
      unknown,
      ProfileFormValues
    >,
    defaultValues,
  });

  return { form };
}
