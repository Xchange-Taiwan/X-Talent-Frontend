'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import {
  createMeetingFeedbackFormSchema,
  DEFAULT_MEETING_RATING,
  type MeetingFeedbackFormValues,
} from '@/schemas/meetingFeedbackSchema';
import type { FeedbackViewerRole } from '@/types/reservationFeedback';

export const DEFAULT_MEETING_FEEDBACK_FORM_VALUES: MeetingFeedbackFormValues = {
  meetingHappened: null,
  rating: DEFAULT_MEETING_RATING,
  content: '',
  notHappenedReason: null,
  notHappenedNote: '',
};

export function useMeetingFeedbackForm(
  defaultValues: MeetingFeedbackFormValues = DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  role: FeedbackViewerRole = 'mentee'
) {
  const schema = React.useMemo(
    () => createMeetingFeedbackFormSchema(role),
    [role]
  );

  return useForm<MeetingFeedbackFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });
}
