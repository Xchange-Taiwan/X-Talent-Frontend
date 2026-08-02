'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm(isMentor: boolean): {
  form: UseFormReturn<ProfileFormValues>;
} {
  const resolver = useMemo(() => {
    return zodResolver(createProfileFormSchema(isMentor));
  }, [isMentor]);

  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
