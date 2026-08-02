'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Resolver, useForm, UseFormReturn } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm(isMentor: boolean): {
  form: UseFormReturn<ProfileFormValues>;
} {
  const resolver = useMemo(() => {
    return zodResolver(
      createProfileFormSchema(isMentor)
    ) as Resolver<ProfileFormValues>;
  }, [isMentor]);

  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
