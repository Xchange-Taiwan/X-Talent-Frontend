'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm() {
  const form = useForm<ProfileFormValues>({
    resolver: (values, context, options) => {
      // Dynamically resolve schema based on form values (values.is_mentor) passed by react-hook-form during validation.
      const activeSchema = createProfileFormSchema(values.is_mentor);
      return zodResolver(activeSchema)(values, context, options);
    },
    defaultValues,
  });

  return { form };
}
