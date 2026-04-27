import { describe, expect, it } from 'vitest';

import { type InterestVO } from '@/services/profile/interests';

import {
  buildOnboardingDtoStub,
  type InterestPools,
} from './buildOnboardingDtoStub';

const vo = (subject_group: string, subject: string): InterestVO => ({
  id: 1,
  subject_group,
  subject,
});

const pools: InterestPools = {
  interestedPositions: [vo('engineer', '工程師'), vo('designer', '設計師')],
  skills: [vo('typescript', 'TypeScript'), vo('react', 'React')],
  topics: [vo('career', '職涯規劃'), vo('frontend', '前端')],
};

const baseFormData = {
  name: 'Mentee A',
  avatar: 'https://cdn.example.com/a.jpg',
  location: 'TWN',
  years_of_experience: '1_3',
  interested_positions: ['engineer'],
  skills: ['typescript'],
  topics: ['career'],
};

describe('buildOnboardingDtoStub', () => {
  it('hydrates form ID arrays into InterestVO[] using the pool lookup', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      pools,
    });

    expect(dto.interested_positions?.interests).toEqual([
      { id: 1, subject_group: 'engineer', subject: '工程師' },
    ]);
    expect(dto.skills?.interests).toEqual([
      { id: 1, subject_group: 'typescript', subject: 'TypeScript' },
    ]);
    expect(dto.topics?.interests).toEqual([
      { id: 1, subject_group: 'career', subject: '職涯規劃' },
    ]);
  });

  it('passes through scalar form fields onto the DTO', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      pools,
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
      pools,
    });

    expect(dto.job_title).toBeNull();
    expect(dto.company).toBeNull();
    expect(dto.industry).toBeNull();
    expect(dto.about).toBeNull();
    expect(dto.personal_statement).toBeNull();
    expect(dto.seniority_level).toBeNull();
    expect(dto.expertises).toBeNull();
    expect(dto.experiences).toEqual([]);
  });

  it('lookup miss → keeps the raw ID as both subject_group and subject so the chip is not silently dropped', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: { ...baseFormData, skills: ['typescript', 'unknown_skill'] },
      pools,
    });

    expect(dto.skills?.interests).toEqual([
      { id: 1, subject_group: 'typescript', subject: 'TypeScript' },
      { id: 0, subject_group: 'unknown_skill', subject: 'unknown_skill' },
    ]);
  });

  it('empty / undefined ID arrays → produce empty interest lists, no crash', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: {
        name: 'Empty',
        interested_positions: [],
        skills: undefined,
        topics: undefined,
      },
      pools,
    });

    expect(dto.interested_positions?.interests).toEqual([]);
    expect(dto.skills?.interests).toEqual([]);
    expect(dto.topics?.interests).toEqual([]);
  });

  it('isMentor=true is honoured (default false)', () => {
    const mentorStub = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      pools,
      isMentor: true,
    });
    expect(mentorStub.is_mentor).toBe(true);

    const menteeStub = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      pools,
    });
    expect(menteeStub.is_mentor).toBe(false);
  });
});
