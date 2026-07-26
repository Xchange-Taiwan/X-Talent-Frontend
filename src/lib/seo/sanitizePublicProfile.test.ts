import { describe, expect, it } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileVO } from '@/services/profile/user';

import { sanitizePublicProfile } from './sanitizePublicProfile';

const baseProfile: MentorProfileVO = {
  user_id: 123,
  name: 'John Doe',
  avatar: 'https://example.com/avatar.png',
  job_title: 'Global Developer',
  company: 'Base Inc',
  years_of_experience: '3',
  location: 'Taipei',
  industry: null,
  onboarding: true,
  is_mentor: true,
  language: 'zh_TW',
  personal_statement: 'Statement',
  about: 'About John',
  seniority_level: null,
  experiences: [],
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
};

describe('sanitizePublicProfile', () => {
  it('should map simple profile properties', () => {
    const profile = { ...baseProfile };
    const sanitized = sanitizePublicProfile(profile);

    expect(sanitized.userId).toBe(123);
    expect(sanitized.name).toBe('John Doe');
    expect(sanitized.avatar).toBe('https://example.com/avatar.png');
    expect(sanitized.about).toBe('About John');
    expect(sanitized.isMentor).toBe(true);
  });

  it('should fallback to outer job_title and company when experiences is empty or null', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      experiences: null,
    };
    const sanitized = sanitizePublicProfile(profile);

    expect(sanitized.jobTitle).toBe('Global Developer');
    expect(sanitized.company).toBe('Base Inc');
  });

  it('should use primary work experience from experiences if available', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      experiences: [
        {
          category: ExperienceType.WORK,
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Secondary Job',
                company: 'Secondary Co',
                is_primary: false,
              },
              { job: 'Primary Job', company: 'Primary Co', is_primary: true },
            ],
          },
        },
      ] as unknown as MentorProfileVO['experiences'],
    };

    const sanitized = sanitizePublicProfile(profile);
    expect(sanitized.jobTitle).toBe('Primary Job');
    expect(sanitized.company).toBe('Primary Co');
  });

  it('should fallback to the first work experience if none is marked primary', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      experiences: [
        {
          category: ExperienceType.WORK,
          order: 1,
          mentor_experiences_metadata: {
            data: [
              { job: 'First Job', company: 'First Co', is_primary: false },
              { job: 'Second Job', company: 'Second Co', is_primary: false },
            ],
          },
        },
      ] as unknown as MentorProfileVO['experiences'],
    };

    const sanitized = sanitizePublicProfile(profile);
    expect(sanitized.jobTitle).toBe('First Job');
    expect(sanitized.company).toBe('First Co');
  });

  it('should preserve empty string for jobTitle or company from experiences and not fallback to outer profile', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      job_title: 'Global Developer',
      company: 'Base Inc',
      experiences: [
        {
          category: ExperienceType.WORK,
          order: 1,
          mentor_experiences_metadata: {
            data: [{ job: '', company: '', is_primary: true }],
          },
        },
      ] as unknown as MentorProfileVO['experiences'],
    };

    const sanitized = sanitizePublicProfile(profile);
    expect(sanitized.jobTitle).toBe('');
    expect(sanitized.company).toBe('');
  });

  it('should filter, deduplicate and check safe URLs for public links', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      experiences: [
        {
          category: ExperienceType.LINK,
          order: 1,
          mentor_experiences_metadata: {
            data: [
              { platform: 'linkedin', url: 'https://linkedin.com/in/first' },
              {
                platform: 'linkedin',
                url: 'https://linkedin.com/in/duplicate',
              }, // duplicate platform
              { platform: 'facebook', url: 'javascript:alert(1)' }, // unsafe URL
              { platform: 'unsupported', url: 'https://unsupported.com' }, // non-whitelisted platform
              { platform: 'facebook', url: 'https://facebook.com/me' }, // whitelisted platform
            ],
          },
        },
      ] as unknown as MentorProfileVO['experiences'],
    };

    const sanitized = sanitizePublicProfile(profile);
    expect(sanitized.personalLinks).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/first' },
      { platform: 'facebook', url: 'https://facebook.com/me' },
    ]);
  });

  it('should resolve expertises and topics with labelMap if provided', () => {
    const profile: MentorProfileVO = {
      ...baseProfile,
      have_skill: ['skill_1', 'skill_2'],
      have_topic: ['topic_1'],
    };

    const labelMap = new Map<string, string>([
      ['skill_1', 'TypeScript'],
      ['topic_1', 'Career growth'],
    ]);

    const sanitized = sanitizePublicProfile(profile, labelMap);
    expect(sanitized.expertises).toEqual(['TypeScript', 'skill_2']);
    expect(sanitized.topics).toEqual(['Career growth']);
  });
});
