import { describe, expect, it } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import type { components } from '@/types/api';

import { mapMentor, type MentorType, resolveMentor } from './mapMentor';

type RawMentor = components['schemas']['SearchMentorProfileVO'];

function createRawMentor(
  overrides: Partial<RawMentor> & { user_id: number }
): RawMentor {
  return {
    user_id: overrides.user_id,
    name: overrides.name !== undefined ? overrides.name : null,
    avatar: overrides.avatar !== undefined ? overrides.avatar : null,
    job_title: overrides.job_title !== undefined ? overrides.job_title : null,
    company: overrides.company !== undefined ? overrides.company : null,
    years_of_experience:
      overrides.years_of_experience !== undefined
        ? overrides.years_of_experience
        : null,
    location: overrides.location !== undefined ? overrides.location : null,
    industry: overrides.industry !== undefined ? overrides.industry : undefined,
    onboarding:
      overrides.onboarding !== undefined ? overrides.onboarding : false,
    is_mentor: overrides.is_mentor !== undefined ? overrides.is_mentor : true,
    language: overrides.language !== undefined ? overrides.language : 'zh_TW',
    personal_statement:
      overrides.personal_statement !== undefined
        ? overrides.personal_statement
        : null,
    about: overrides.about !== undefined ? overrides.about : null,
    seniority_level:
      overrides.seniority_level !== undefined
        ? overrides.seniority_level
        : null,
    want_position:
      overrides.want_position !== undefined ? overrides.want_position : null,
    want_skill:
      overrides.want_skill !== undefined ? overrides.want_skill : null,
    want_topic:
      overrides.want_topic !== undefined ? overrides.want_topic : null,
    have_skill:
      overrides.have_skill !== undefined ? overrides.have_skill : null,
    have_topic:
      overrides.have_topic !== undefined ? overrides.have_topic : null,
    updated_at:
      overrides.updated_at !== undefined ? overrides.updated_at : null,
    views: overrides.views !== undefined ? overrides.views : 0,
  };
}

describe('mapMentor', () => {
  it('correctly maps raw mentor response to MentorType', () => {
    const raw = createRawMentor({
      user_id: 123,
      name: 'John Doe',
      avatar: 'https://example.com/avatar.jpg',
      job_title: 'Software Engineer',
      company: 'Tech Corp',
      years_of_experience: '3_5',
      location: 'Taiwan',
      personal_statement: 'Hello',
      about: 'About me',
      seniority_level: 'SENIOR',
      want_position: ['engineer'],
      want_skill: ['typescript'],
      want_topic: ['react'],
      have_skill: ['nodejs'],
      have_topic: ['topic_a', 'topic_b'],
      updated_at: 1610000000,
    });

    const mapped = mapMentor(raw);

    expect(mapped).toEqual({
      user_id: 123,
      name: 'John Doe',
      avatar: 'https://example.com/avatar.jpg',
      job_title: 'Software Engineer',
      company: 'Tech Corp',
      years_of_experience: '3_5',
      location: 'Taiwan',
      personal_statement: 'Hello',
      about: 'About me',
      seniority_level: 'SENIOR',
      industry: null,
      want_position: ['engineer'],
      want_skill: ['typescript'],
      want_topic: ['react'],
      have_skill: ['nodejs'],
      have_topic: ['topic_a', 'topic_b'],
      updated_at: 1610000000,
    });
  });

  it('handles null and field omissions gracefully in mapMentor', () => {
    const raw = createRawMentor({
      user_id: 456,
    });

    const mapped = mapMentor(raw);

    expect(mapped).toEqual({
      user_id: 456,
      name: '',
      avatar: '',
      job_title: '',
      company: '',
      years_of_experience: '',
      location: '',
      personal_statement: '',
      about: '',
      seniority_level: '',
      industry: null,
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: [],
      have_topic: [],
      updated_at: null,
    });
  });
});

describe('resolveMentor', () => {
  const baseMentor: MentorType = {
    user_id: 123,
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
    job_title: 'Software Engineer',
    company: 'Tech Corp',
    years_of_experience: '3_5',
    location: 'Taiwan',
    personal_statement: 'Hello',
    about: 'About me',
    seniority_level: 'Senior',
    industry: 'technology',
    want_position: ['engineer'],
    want_skill: ['typescript'],
    want_topic: ['react'],
    have_skill: ['nodejs'],
    have_topic: ['topic_a', 'topic_b'],
    updated_at: 1610000000,
  };

  it('applies avatar cache-busting when updated_at is present', () => {
    const resolved = resolveMentor(baseMentor);
    expect(resolved.avatar).toBe(
      'https://example.com/avatar.jpg?cb=1610000000'
    );
  });

  it('does not apply avatar cache-busting when updated_at is null', () => {
    const mentor = { ...baseMentor, updated_at: null };
    const resolved = resolveMentor(mentor);
    expect(resolved.avatar).toBe('https://example.com/avatar.jpg');
  });

  it('falls back to default avatar image when avatar is empty', () => {
    const mentor = { ...baseMentor, avatar: '' };
    const resolved = resolveMentor(mentor);
    expect(resolved.avatar).toBe(avatarImage);
  });

  it('resolves have_topic codes using the provided labelMap', () => {
    const labelMap = new Map<string, string>([
      ['topic_a', 'Topic A Localized'],
      ['topic_b', 'Topic B Localized'],
    ]);

    const resolved = resolveMentor(baseMentor, labelMap);
    expect(resolved.have_topic).toEqual([
      'Topic A Localized',
      'Topic B Localized',
    ]);
  });

  it('falls back to the code when the labelMap is missing or does not contain the key', () => {
    const labelMap = new Map<string, string>([
      ['topic_a', 'Topic A Localized'],
    ]);

    const resolved = resolveMentor(baseMentor, labelMap);
    expect(resolved.have_topic).toEqual(['Topic A Localized', 'topic_b']);

    const resolvedNoMap = resolveMentor(baseMentor);
    expect(resolvedNoMap.have_topic).toEqual(['topic_a', 'topic_b']);
  });
});
