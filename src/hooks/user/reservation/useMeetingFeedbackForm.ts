'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  DEFAULT_MEETING_RATING,
  meetingFeedbackFormSchema,
  type MeetingFeedbackFormValues,
} from '@/schemas/meetingFeedbackSchema';

export const DEFAULT_MEETING_FEEDBACK_FORM_VALUES: MeetingFeedbackFormValues = {
  meetingHappened: null,
  rating: DEFAULT_MEETING_RATING,
  content: '',
  notHappenedReason: null,
};

export function useMeetingFeedbackForm() {
  return useForm<MeetingFeedbackFormValues>({
    resolver: zodResolver(meetingFeedbackFormSchema),
    defaultValues: DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
    mode: 'onChange',
  });
}
