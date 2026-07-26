import { describe, expect, it, vi } from 'vitest';

import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';
import { MentorProfileVO } from '@/services/profile/user';

import {
  computeDirtyStates,
  hasDirtyValue,
  isProfileSynced,
  mapFormValuesToPayload,
  mapVoToFormValues,
} from './profileSaveAdapter';

vi.mock('@/lib/profile/readIndustryTag', () => ({
  readIndustryTag: vi.fn((industry) => {
    if (
      industry &&
      typeof industry === 'object' &&
      'subject_group' in industry
    ) {
      return industry;
    }
    return null;
  }),
}));

describe('profileSaveAdapter', () => {
  describe('hasDirtyValue', () => {
    it('returns false for falsy values', () => {
      expect(hasDirtyValue(null)).toBe(false);
      expect(hasDirtyValue(undefined)).toBe(false);
      expect(hasDirtyValue(false)).toBe(false);
      expect(hasDirtyValue('')).toBe(false);
    });

    it('returns true for boolean true', () => {
      expect(hasDirtyValue(true)).toBe(true);
    });

    it('recursively checks arrays', () => {
      expect(hasDirtyValue([false, null, undefined])).toBe(false);
      expect(hasDirtyValue([false, true, null])).toBe(true);
    });

    it('recursively checks objects', () => {
      expect(hasDirtyValue({ a: false, b: null })).toBe(false);
      expect(hasDirtyValue({ a: false, b: { c: true } })).toBe(true);
    });
  });

  describe('mapVoToFormValues', () => {
    const mockVo: MentorProfileVO = {
      user_id: 42,
      name: 'John Doe',
      avatar: 'https://avatar.com/john',
      job_title: null,
      company: null,
      location: 'Taipei',
      personal_statement: 'My statement',
      about: 'About me',
      years_of_experience: '3_5',
      industry: {
        id: 100,
        kind: 'industry',
        subject_group: 'tech',
        subject: 'Software',
        language: 'zh_TW',
      } as unknown as MentorProfileVO['industry'],
      experiences: [
        {
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Engineer',
                company: 'Google',
                job_period_start: '2020',
                job_period_end: '2023',
                industry: 'Tech',
                job_location: 'Taipei',
                description: 'Coding',
                is_primary: true,
              },
            ],
          } as unknown as Record<string, never>,
        },
      ],
      onboarding: true,
      is_mentor: true,
      language: 'zh_TW',
      seniority_level: null,
      want_position: ['Developer'],
      want_skill: ['React'],
      want_topic: ['Career'],
      have_skill: ['JS'],
      have_topic: ['Onboarding'],
    };

    it('correctly maps a VO to form values', () => {
      const result = mapVoToFormValues(mockVo, false);
      expect(result.name).toBe('John Doe');
      expect(result.avatar).toBe('https://avatar.com/john');
      expect(result.location).toBe('Taipei');
      expect(result.statement).toBe('My statement');
      expect(result.about).toBe('About me');
      expect(result.industry).toBe('tech');
      expect(result.years_of_experience).toBe('3_5');
      expect(result.work_experiences).toHaveLength(1);
      expect(result.work_experiences[0].company).toBe('Google');
      expect(result.work_experiences[0].job).toBe('Engineer');
      expect(result.want_position).toEqual(['Developer']);
    });
  });

  describe('computeDirtyStates', () => {
    const mockValues: ProfileFormValues = {
      ...defaultValues,
      name: 'Alice',
      avatarFile: undefined,
    };

    it('returns all dirty as true if dirtyFields is undefined', () => {
      const { experiencesDirty, profileDirty } = computeDirtyStates(
        mockValues,
        undefined,
        false
      );
      expect(experiencesDirty).toBe(true);
      expect(profileDirty).toBe(true);
    });

    it('correctly identifies dirty fields based on dirtyFields map', () => {
      const dirtyFields = {
        name: true,
      };
      const { experiencesDirty, profileDirty } = computeDirtyStates(
        mockValues,
        dirtyFields,
        false
      );
      expect(experiencesDirty).toBe(false);
      expect(profileDirty).toBe(true);
    });

    it('forces profileDirty when isMentorOnboarding is true', () => {
      const { profileDirty } = computeDirtyStates(mockValues, {}, true);
      expect(profileDirty).toBe(true);
    });

    it('forces profileDirty when avatarFile is present', () => {
      const valuesWithAvatar = {
        ...mockValues,
        avatarFile: new File([], 'avatar.png'),
      };
      const { profileDirty } = computeDirtyStates(valuesWithAvatar, {}, false);
      expect(profileDirty).toBe(true);
    });

    it('returns experiencesDirty and profileDirty as true when a single social link is dirty', () => {
      const dirtyFields = {
        linkedin: true,
      };
      const { experiencesDirty, profileDirty } = computeDirtyStates(
        mockValues,
        dirtyFields,
        false
      );
      expect(experiencesDirty).toBe(true);
      expect(profileDirty).toBe(true);
    });
  });

  describe('mapFormValuesToPayload', () => {
    it('constructs payload from form values and avatar', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        name: 'Bob',
        work_experiences: [
          {
            id: 0,
            job: 'Manager',
            company: 'Apple',
            job_period_start: '2021',
            job_period_end: '2024',
            industry: 'Tech',
            job_location: 'US',
            description: 'Managing',
            is_primary: true,
          },
        ],
      };

      const payload = mapFormValuesToPayload(
        mockValues,
        'https://avatar.com/bob',
        true
      );
      expect(payload.name).toBe('Bob');
      expect(payload.avatar).toBe('https://avatar.com/bob');
      expect(payload.job_title).toBe('Manager');
      expect(payload.company).toBe('Apple');
      expect(payload.experiences).toHaveLength(3);
    });

    it('filters out invalid/empty personal links', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        linkedin: {
          id: 1,
          platform: 'linkedin',
          url: 'https://linkedin.com/in/bob',
        },
        facebook: { id: 2, platform: 'facebook', url: '' },
      };

      const payload = mapFormValuesToPayload(mockValues, undefined, true);
      const linkExperience = payload.experiences?.find(
        (e) => e.category === 'LINK'
      );
      const linksData = linkExperience?.mentor_experiences_metadata
        ?.data as unknown as { platform: string; url: string }[];
      expect(linksData).toHaveLength(1);
      expect(linksData[0].platform).toBe('linkedin');
      expect(linksData[0].url).toBe('https://linkedin.com/in/bob');
    });

    it('retains undefined avatar to avoid clearing existing avatar in the backend', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        avatar: 'https://existing-avatar.com/bob',
      };
      const payload = mapFormValuesToPayload(mockValues, undefined, false);
      expect(payload.avatar).toBeUndefined();
    });
  });

  describe('isProfileSynced', () => {
    const mockValues: ProfileFormValues = {
      ...defaultValues,
      name: 'Bob',
      location: 'Taipei',
      statement: 'Hi',
      about: 'About',
      industry: 'tech',
      years_of_experience: '3_5',
    };

    const mockVo: MentorProfileVO = {
      user_id: 1,
      name: 'Bob',
      avatar: 'https://avatar.com/bob',
      job_title: null,
      company: null,
      location: 'Taipei',
      personal_statement: 'Hi',
      about: 'About',
      years_of_experience: '3_5',
      industry: {
        id: 1,
        kind: 'industry',
        subject_group: 'tech',
        subject: 'Software',
        language: 'zh_TW',
      } as unknown as MentorProfileVO['industry'],
      experiences: [],
      onboarding: true,
      is_mentor: true,
      language: 'zh_TW',
      seniority_level: null,
      want_position: null,
      want_skill: null,
      want_topic: null,
      have_skill: null,
      have_topic: null,
    };

    it('returns true if all checked fields match', () => {
      expect(
        isProfileSynced(mockValues, mockVo, 'https://avatar.com/bob')
      ).toBe(true);
    });

    it('returns false if name differs', () => {
      const differentVo = { ...mockVo, name: 'Alice' };
      expect(
        isProfileSynced(mockValues, differentVo, 'https://avatar.com/bob')
      ).toBe(false);
    });

    it('returns false if location differs', () => {
      const differentVo = { ...mockVo, location: 'Hsinchu' };
      expect(
        isProfileSynced(mockValues, differentVo, 'https://avatar.com/bob')
      ).toBe(false);
    });

    it('returns false if avatar differs', () => {
      expect(
        isProfileSynced(mockValues, mockVo, 'https://avatar.com/new-bob')
      ).toBe(false);
    });

    it('returns true if avatar is empty or matches', () => {
      expect(isProfileSynced(mockValues, mockVo, '')).toBe(true);
      expect(
        isProfileSynced(mockValues, mockVo, 'https://avatar.com/bob')
      ).toBe(true);
    });

    it('returns false if industry differs', () => {
      const differentVo = {
        ...mockVo,
        industry: {
          id: 1,
          kind: 'industry',
          subject_group: 'finance',
          subject: 'Banking',
          language: 'zh_TW',
        } as unknown as MentorProfileVO['industry'],
      };
      expect(
        isProfileSynced(mockValues, differentVo, 'https://avatar.com/bob')
      ).toBe(false);
    });
  });
});
