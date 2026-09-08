import { Session } from 'next-auth';

import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';
import type { MentorProfileVO } from '@/types/user';

export const mockSession: Session = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    onBoarding: true,
    isMentor: true,
    // Matches mockUserDTO.avatar below so tests that don't exercise an
    // avatar change don't spuriously trip identity reconciliation
    // (X-Tracker #670 widened reconciliation to cover avatar/name too).
    avatar: 'https://example.com/avatar.jpg',
  },
  accessToken: 'mock-token',
  expires: '2099-01-01T00:00:00.000Z',
};

export const baseValues: ProfileFormValues = {
  ...defaultValues,
  industry: defaultValues.industry ?? '',
  name: 'Test User',
  location: 'Taiwan',
  years_of_experience: '1_3',
  want_position: ['engineer'],
  want_skill: ['TypeScript'],
  want_topic: ['frontend'],
  // Mirrors how a real edit form is pre-populated (mapVoToFormValues sets
  // this from the current userDto.avatar) and matches mockSession/
  // mockUserDTO's avatar, so a save that doesn't touch the avatar doesn't
  // spuriously disagree with backend truth during identity reconciliation.
  avatar: 'https://example.com/avatar.jpg',
};

export const mockUserDTO: MentorProfileVO = {
  user_id: 1,
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  job_title: 'Engineer',
  company: 'Acme',
  years_of_experience: '1_3',
  location: 'Taiwan',
  industry: {
    id: 1,
    kind: 'industry',
    subject_group: 'tech',
    subject: 'software',
    language: 'zh_TW',
  } as unknown as MentorProfileVO['industry'],
  onboarding: true,
  is_mentor: true,
  language: 'zh_TW',
  personal_statement: null,
  about: null,
  seniority_level: null,
  want_position: null,
  want_skill: null,
  want_topic: null,
  have_skill: null,
  have_topic: null,
};
