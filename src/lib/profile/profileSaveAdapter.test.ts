import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import {
  computeDirtyStates,
  hasDirtyValue,
  isProfileSynced,
  mapFormValuesToPayload,
  mapVoToFormValues,
  resolveOptimisticIndustry,
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
    const mockVo = fromPartial<MentorProfileVO>({
      user_id: 42,
      name: 'John Doe',
      avatar: 'https://avatar.com/john',
      job_title: null,
      company: null,
      location: 'Taipei',
      personal_statement: 'My statement',
      about: 'About me',
      years_of_experience: '3_5',
      industry: fromAny({
        id: 100,
        kind: 'industry',
        subject_group: 'tech',
        subject: 'Software',
        language: 'zh_TW',
      }),
      experiences: [
        {
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: fromAny({
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
          }),
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
    });

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

    it('correctly falls back to defaults when optional API fields are null or empty', () => {
      const incompleteVo = fromPartial<MentorProfileVO>({
        user_id: 99,
        name: null,
        avatar: null,
        job_title: null,
        company: null,
        location: null,
        personal_statement: null,
        about: null,
        years_of_experience: null,
        industry: null,
        experiences: [],
        onboarding: false,
        is_mentor: false,
        language: 'zh_TW',
        seniority_level: null,
        want_position: null,
        want_skill: null,
        want_topic: null,
        have_skill: null,
        have_topic: null,
      });

      const result = mapVoToFormValues(incompleteVo, false);

      expect(result.name).toBe('');
      expect(result.avatar).toBe('');
      expect(result.location).toBe('');
      expect(result.statement).toBe('');
      expect(result.about).toBe('');
      expect(result.industry).toBe('');
      expect(result.years_of_experience).toBe('');
      expect(result.work_experiences).toEqual([]);
      expect(result.educations).toEqual([]);
      expect(result.links).toEqual({
        linkedin: '',
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: '',
        website: '',
      });
      expect(result.have_topic).toEqual([]);
      expect(result.have_skill).toEqual([]);
    });

    it('hydrates valid social links into result.links while dropping mismatched-host or unsafe URLs', () => {
      const voWithLinks = fromPartial<MentorProfileVO>({
        ...mockVo,
        experiences: [
          {
            category: 'LINK',
            order: 3,
            mentor_experiences_metadata: fromAny({
              data: [
                {
                  platform: 'linkedin',
                  url: 'https://www.linkedin.com/in/john',
                },
                {
                  platform: 'twitter',
                  url: 'https://evil-twitter.com/john',
                },
                {
                  platform: 'website',
                  url: 'https://johndoe.dev',
                },
              ],
            }),
          },
        ],
      });

      const result = mapVoToFormValues(voWithLinks, false);
      expect(result.links).toEqual({
        linkedin: 'https://www.linkedin.com/in/john',
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: '',
        website: 'https://johndoe.dev',
      });
    });
  });

  describe('computeDirtyStates', () => {
    const mockValues: ProfileFormValues = {
      ...defaultValues,
      industry: defaultValues.industry ?? '',
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

    it('returns experiencesDirty and profileDirty as true when a single social link in links is dirty', () => {
      const dirtyFields = {
        links: { linkedin: true },
      };
      const { experiencesDirty, profileDirty } = computeDirtyStates(
        mockValues,
        dirtyFields,
        false
      );
      expect(experiencesDirty).toBe(true);
      expect(profileDirty).toBe(true);

      expect(
        computeDirtyStates(mockValues, { links: { linkedin: false } }, false)
      ).toEqual({
        experiencesDirty: false,
        profileDirty: false,
      });

      expect(computeDirtyStates(mockValues, { links: true }, false)).toEqual({
        experiencesDirty: true,
        profileDirty: true,
      });
    });
  });

  describe('mapFormValuesToPayload', () => {
    it('constructs payload from form values and avatar', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        industry: defaultValues.industry ?? '',
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

    it('normalizes scheme-omitted personal links and filters out empty or host-mismatched links', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        industry: defaultValues.industry ?? '',
        links: {
          ...defaultValues.links,
          linkedin: 'linkedin.com/in/bob',
          facebook: '',
          instagram: 'https://evil-instagram.com/bob',
        },
      };

      const payload = mapFormValuesToPayload(mockValues, undefined, true);
      const linkExperience = payload.experiences?.find(
        (e) => e.category === 'LINK'
      );
      const rawMetadata = linkExperience?.mentor_experiences_metadata;
      const linksData = Array.isArray(rawMetadata?.data)
        ? rawMetadata.data
        : [];
      expect(linksData).toHaveLength(1);
      expect(linksData[0]).toMatchObject({
        platform: 'linkedin',
        url: 'https://linkedin.com/in/bob',
      });
    });

    it('retains undefined avatar to avoid clearing existing avatar in the backend', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        industry: defaultValues.industry ?? '',
        avatar: 'https://existing-avatar.com/bob',
      };
      const payload = mapFormValuesToPayload(mockValues, undefined, false);
      expect(payload.avatar).toBeUndefined();
    });

    it('omits experiences property when experiencesDirty is false to respect three-state semantics', () => {
      const mockValues: ProfileFormValues = {
        ...defaultValues,
        industry: defaultValues.industry ?? '',
        name: 'Bob',
      };
      const payload = mapFormValuesToPayload(mockValues, undefined, false);
      expect(payload).not.toHaveProperty('experiences');
      expect(payload.experiences).toBeUndefined();
    });
  });

  describe('resolveOptimisticIndustry', () => {
    const catalog: IndustryOption[] = [
      { subject_group: 'tech', subject: '軟體與科技' },
      { subject_group: 'finance', subject: '金融業' },
    ];

    it('resolves localized subject from industryCatalog when switching to a new industry code', () => {
      const currentIndustry: MentorProfileVO['industry'] = fromAny({
        id: 1,
        kind: 'industry',
        subject_group: 'tech',
        subject: '軟體與科技',
        language: 'zh_TW',
      });

      expect(
        resolveOptimisticIndustry('finance', catalog, currentIndustry, true)
      ).toEqual({
        subject_group: 'finance',
        subject: '金融業',
      });
    });

    it('does not leak stale subject from currentIndustry when switching codes and catalog is unavailable', () => {
      const currentIndustry: MentorProfileVO['industry'] = fromAny({
        id: 1,
        kind: 'industry',
        subject_group: 'tech',
        subject: '軟體與科技',
        language: 'zh_TW',
      });

      expect(
        resolveOptimisticIndustry('finance', [], currentIndustry, true)
      ).toEqual({
        subject_group: 'finance',
        subject: '',
      });
    });

    it('preserves existing industry metadata when code is unchanged and catalog is omitted', () => {
      const currentIndustry: MentorProfileVO['industry'] = fromAny({
        id: 1,
        kind: 'industry',
        subject_group: 'tech',
        subject: '軟體與科技',
        language: 'zh_TW',
      });

      expect(
        resolveOptimisticIndustry('tech', undefined, currentIndustry, false)
      ).toEqual(currentIndustry);
    });

    it('returns null when industry is explicitly cleared while dirty, and preserves currentIndustry otherwise', () => {
      const currentIndustry: MentorProfileVO['industry'] = fromAny({
        subject_group: 'tech',
        subject: '軟體與科技',
      });

      expect(
        resolveOptimisticIndustry('', catalog, currentIndustry, true)
      ).toBeNull();
      expect(
        resolveOptimisticIndustry('', catalog, currentIndustry, false)
      ).toBe(currentIndustry);
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

    const mockVo = fromPartial<MentorProfileVO>({
      user_id: 1,
      name: 'Bob',
      avatar: 'https://avatar.com/bob?v=1754000000000',
      job_title: null,
      company: null,
      location: 'Taipei',
      personal_statement: 'Hi',
      about: 'About',
      years_of_experience: '3_5',
      industry: fromAny({
        id: 1,
        kind: 'industry',
        subject_group: 'tech',
        subject: 'Software',
        language: 'zh_TW',
      }),
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
    });

    it('returns true if all checked fields match (including ?v= + &cb= avatar convergence)', () => {
      expect(
        isProfileSynced(
          mockValues,
          mockVo,
          'https://avatar.com/bob?v=1754000000000'
        )
      ).toBe(true);
      expect(
        isProfileSynced(
          mockValues,
          {
            ...mockVo,
            avatar:
              'https://avatar.com/bob?v=1754000000000&cb=2026-11-14T00%3A00%3A00Z',
          },
          'https://avatar.com/bob?v=1754000000000'
        )
      ).toBe(true);
    });

    it('returns false if name differs', () => {
      const differentVo = { ...mockVo, name: 'Alice' };
      expect(
        isProfileSynced(
          mockValues,
          differentVo,
          'https://avatar.com/bob?v=1754000000000'
        )
      ).toBe(false);
    });

    it('returns false if location differs', () => {
      const differentVo = { ...mockVo, location: 'Hsinchu' };
      expect(
        isProfileSynced(
          mockValues,
          differentVo,
          'https://avatar.com/bob?v=1754000000000'
        )
      ).toBe(false);
    });

    it('returns false if avatar version or asset differs', () => {
      expect(
        isProfileSynced(
          mockValues,
          mockVo,
          'https://avatar.com/bob?v=1754000099999'
        )
      ).toBe(false);
      expect(
        isProfileSynced(mockValues, mockVo, 'https://avatar.com/new-bob')
      ).toBe(false);
    });

    it('returns true if avatar expectation is empty', () => {
      expect(isProfileSynced(mockValues, mockVo, '')).toBe(true);
    });

    it('returns false if industry differs', () => {
      const differentVo: MentorProfileVO = {
        ...mockVo,
        industry: fromAny({
          id: 1,
          kind: 'industry',
          subject_group: 'finance',
          subject: 'Banking',
          language: 'zh_TW',
        }),
      };
      expect(
        isProfileSynced(
          mockValues,
          differentVo,
          'https://avatar.com/bob?v=1754000000000'
        )
      ).toBe(false);
    });
  });
});
