'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  quickReplyFormSchema,
  QuickReplyFormValues,
} from '@/schemas/quickReplySchema';

export function useQuickReplyForm() {
  return useForm<QuickReplyFormValues>({
    resolver: zodResolver(quickReplyFormSchema),
    defaultValues: {
      reply: '',
    },
    mode: 'onChange',
  });
}
