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

export function useEditProfileForm(isMentor: boolean): {
  form: UseFormReturn<ProfileFormInput, any, ProfileFormValues>;
} {
  const resolver = useMemo(() => {
    return zodResolver<ProfileFormInput, any, ProfileFormValues>(
      createProfileFormSchema(isMentor)
    );
  }, [isMentor]);

  const form = useForm<ProfileFormInput, any, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
