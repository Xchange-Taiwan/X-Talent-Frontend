'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

export function useEditProfileForm() {
  const isMentorRef = useRef(false);

  const form = useForm<ProfileFormValues>({
    resolver: (...args) =>
      zodResolver(createProfileFormSchema(isMentorRef.current))(...args),
    defaultValues,
  });

  return { form, isMentorRef };
}
