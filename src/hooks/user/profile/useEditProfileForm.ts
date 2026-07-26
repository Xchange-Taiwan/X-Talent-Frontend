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

  const syncMentorStatus = (isMentor: boolean) => {
    isMentorRef.current = isMentor;
  };

  const form = useForm<ProfileFormValues>({
    resolver: (values, context, options) => {
      const activeSchema = createProfileFormSchema(isMentorRef.current);
      return zodResolver(activeSchema)(values, context, options);
    },
    defaultValues,
  });

  return { form, syncMentorStatus };
}
