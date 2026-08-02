'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormContext,
  ProfileFormInput,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm(isMentor: boolean): {
  form: ProfileFormContext;
} {
  const resolver = useMemo(() => {
    return zodResolver<ProfileFormInput, unknown, ProfileFormValues>(
      createProfileFormSchema(isMentor)
    );
  }, [isMentor]);

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  return { form };
}
