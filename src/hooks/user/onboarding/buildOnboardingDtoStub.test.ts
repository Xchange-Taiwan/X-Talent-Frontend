import { describe, expect, it } from 'vitest';

import type { IndustryOption } from '@/services/profile/tagCatalog';

import { buildOnboardingDtoStub } from './buildOnboardingDtoStub';

const baseFormData = {
  name: 'Mentee A',
  avatar: 'https://cdn.example.com/a.jpg',
  location: 'TWN',
  years_of_experience: '1_3',
  want_position: ['engineer'],
  want_skill: ['typescript'],
  want_topic: ['career'],
};

const industryCatalog: IndustryOption[] = [
  { subject_group: 'tech', subject: '科技 / 軟體' },
  { subject_group: 'finance', subject: '金融 / 投資' },
];

describe('buildOnboardingDtoStub', () => {
  it('passes raw subject_group codes through onto the stubbed buckets', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
    });

    expect(dto.want_position).toEqual(['engineer']);
    expect(dto.want_skill).toEqual(['typescript']);
    expect(dto.want_topic).toEqual(['career']);
  });

  it('passes through scalar form fields onto the DTO', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
    });

    expect(dto.user_id).toBe(42);
    expect(dto.name).toBe('Mentee A');
    expect(dto.avatar).toBe('https://cdn.example.com/a.jpg');
    expect(dto.location).toBe('TWN');
    expect(dto.years_of_experience).toBe('1_3');
    expect(dto.onboarding).toBe(true);
    expect(dto.is_mentor).toBe(false);
    expect(dto.language).toBe('zh_TW');
  });

  it('fills unused mentee-branch fields with safe defaults', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
    });

    expect(dto.job_title).toBeNull();
    expect(dto.company).toBeNull();
    expect(dto.industry).toBeNull();
    expect(dto.about).toBeNull();
    expect(dto.personal_statement).toBeNull();
    expect(dto.seniority_level).toBeNull();
    expect(dto.experiences).toEqual([]);
    expect(dto.have_skill).toBeNull();
    expect(dto.have_topic).toBeNull();
  });

  it('empty / undefined ID arrays → produce empty bucket arrays, no crash', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: {
        name: 'Empty',
        want_position: [],
        want_skill: undefined,
        want_topic: undefined,
      },
    });

    expect(dto.want_position).toEqual([]);
    expect(dto.want_skill).toEqual([]);
    expect(dto.want_topic).toEqual([]);
  });

  it('isMentor=true is honoured (default false)', () => {
    const mentorStub = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      isMentor: true,
    });
    expect(mentorStub.is_mentor).toBe(true);

    const menteeStub = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
    });
    expect(menteeStub.is_mentor).toBe(false);
  });

  // Regression: prior to this fix, industry was hardcoded to null in the
  // stub, so navigating from /onboarding → /profile/edit through the primed
  // cache rendered an empty industry field even when one was just selected.
  it('resolves the submitted industry against the catalog into a TagVO-shaped object', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: { ...baseFormData, industry: 'tech' },
      industryCatalog,
    });

    expect(dto.industry).toEqual({
      subject_group: 'tech',
      subject: '科技 / 軟體',
    });
  });

  it('returns industry=null when the submitted code is not in the catalog', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: { ...baseFormData, industry: 'unknown' },
      industryCatalog,
    });

    expect(dto.industry).toBeNull();
  });

  it('returns industry=null when no industry was submitted, even if a catalog is provided', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      industryCatalog,
    });

    expect(dto.industry).toBeNull();
  });
});
