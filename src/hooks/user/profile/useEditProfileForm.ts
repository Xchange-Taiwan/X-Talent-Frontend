'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm(isMentor: boolean): {
  form: UseFormReturn<ProfileFormValues>;
} {
  const resolver = useMemo(() => {
    const schema = createProfileFormSchema(
      isMentor
    ) as unknown as z.ZodSchema<ProfileFormValues>;
    return zodResolver(schema);
  }, [isMentor]);

  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
