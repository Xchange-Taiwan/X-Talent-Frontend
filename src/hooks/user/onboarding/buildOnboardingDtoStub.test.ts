import { describe, expect, it } from 'vitest';

import type { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import {
  buildOnboardingDtoStub,
  type TagPools,
} from './buildOnboardingDtoStub';

const group = (
  groupKey: string,
  groupLabel: string,
  leaves: { subject_group: string; subject: string }[]
): TagCatalogGroupVO => ({
  subject_group: groupKey,
  subject: groupLabel,
  language: 'zh_TW',
  leaves: leaves.map((l, idx) => ({
    tag_id: idx + 1,
    subject_group: l.subject_group,
    subject: l.subject,
    language: 'zh_TW',
  })),
});

const pools: TagPools = {
  want_position: [
    group('positions', '職位', [
      { subject_group: 'engineer', subject: '工程師' },
      { subject_group: 'designer', subject: '設計師' },
    ]),
  ],
  want_skill: [
    group('skills', '技能', [
      { subject_group: 'typescript', subject: 'TypeScript' },
      { subject_group: 'react', subject: 'React' },
    ]),
  ],
  want_topic: [
    group('topics', '主題', [
      { subject_group: 'career', subject: '職涯規劃' },
      { subject_group: 'frontend', subject: '前端' },
    ]),
  ],
};

const baseFormData = {
  name: 'Mentee A',
  avatar: 'https://cdn.example.com/a.jpg',
  location: 'TWN',
  years_of_experience: '1_3',
  want_position: ['engineer'],
  want_skill: ['typescript'],
  want_topic: ['career'],
};

describe('buildOnboardingDtoStub', () => {
  it('hydrates form ID arrays into TagVO[] using the catalog leaf lookup', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: baseFormData,
      pools,
    });

    expect(dto.want_position).toEqual([
      {
        id: 1,
        kind: '',
        subject_group: 'engineer',
        language: 'zh_TW',
        subject: '工程師',
      },
    ]);
    expect(dto.want_skill).toEqual([
      {
        id: 1,
        kind: '',
        subject_group: 'typescript',
        language: 'zh_TW',
        subject: 'TypeScript',
      },
    ]);
    expect(dto.want_topic).toEqual([
      {
        id: 1,
        kind: '',
        subject_group: 'career',
        language: 'zh_TW',
        subject: '職涯規劃',
      },
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
    expect(dto.have_skill).toBeNull();
    expect(dto.have_topic).toBeNull();
  });

  it('lookup miss → keeps the raw ID as both subject_group and subject so the chip is not silently dropped', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: {
        ...baseFormData,
        want_skill: ['typescript', 'unknown_skill'],
      },
      pools,
    });

    expect(dto.want_skill).toEqual([
      {
        id: 1,
        kind: '',
        subject_group: 'typescript',
        language: 'zh_TW',
        subject: 'TypeScript',
      },
      {
        id: 0,
        kind: '',
        subject_group: 'unknown_skill',
        subject: 'unknown_skill',
      },
    ]);
  });

  it('empty / undefined ID arrays → produce empty tag lists, no crash', () => {
    const dto = buildOnboardingDtoStub({
      userId: 42,
      formData: {
        name: 'Empty',
        want_position: [],
        want_skill: undefined,
        want_topic: undefined,
      },
      pools,
    });

    expect(dto.want_position).toEqual([]);
    expect(dto.want_skill).toEqual([]);
    expect(dto.want_topic).toEqual([]);
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
