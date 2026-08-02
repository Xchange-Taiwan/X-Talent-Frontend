import { describe, expect, it } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import type { components } from '@/types/api';
import type { MentorType } from '@/types/mentor';

import { mapMentor, resolveMentorAvatar } from './mapMentor';

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
      avatar: 'https://example.com/avatar.jpg?cb=1610000000',
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
      avatar: avatarImage,
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

  it('combines resolveMentorAvatar behavior inside mapMentor', () => {
    // 1. empty avatar falls back to default image
    const rawNoAvatar = createRawMentor({ user_id: 777, avatar: null });
    const mappedNoAvatar = mapMentor(rawNoAvatar);
    expect(mappedNoAvatar.avatar).toBe(avatarImage);

    // 2. presence of avatar without updated_at does not cache-bust
    const rawNoUpdated = createRawMentor({
      user_id: 888,
      avatar: 'https://example.com/avatar.jpg',
      updated_at: null,
    });
    const mappedNoUpdated = mapMentor(rawNoUpdated);
    expect(mappedNoUpdated.avatar).toBe('https://example.com/avatar.jpg');

    // 3. presence of avatar with updated_at applies cache-busting
    const rawWithUpdated = createRawMentor({
      user_id: 999,
      avatar: 'https://example.com/avatar.jpg',
      updated_at: 1620000000,
    });
    const mappedWithUpdated = mapMentor(rawWithUpdated);
    expect(mappedWithUpdated.avatar).toBe(
      'https://example.com/avatar.jpg?cb=1620000000'
    );
  });
});

describe('resolveMentorAvatar', () => {
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
    const resolved = resolveMentorAvatar(baseMentor);
    expect(resolved.avatar).toBe(
      'https://example.com/avatar.jpg?cb=1610000000'
    );
  });

  it('does not apply avatar cache-busting when updated_at is null', () => {
    const mentor = { ...baseMentor, updated_at: null };
    const resolved = resolveMentorAvatar(mentor);
    expect(resolved.avatar).toBe('https://example.com/avatar.jpg');
  });

  it('falls back to default avatar image when avatar is empty', () => {
    const mentor = { ...baseMentor, avatar: '' };
    const resolved = resolveMentorAvatar(mentor);
    expect(resolved.avatar).toBe(avatarImage);
  });
});
