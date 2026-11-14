import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import type { MentorType } from '@/types/mentor';

import { buildMentorCardTags, MentorCardList } from './index';

function makeMentor(
  userId: number,
  overrides: Partial<MentorType> = {}
): MentorType {
  return fromPartial<MentorType>({
    user_id: userId,
    name: `Mentor ${userId}`,
    avatar: avatarImage,
    job_title: 'Senior Engineer',
    company: 'Acme',
    years_of_experience: 'THREE_TO_FIVE',
    location: 'TWN',
    personal_statement: '',
    about: '專注於前端架構與職涯輔導。',
    seniority_level: 'SENIOR',
    industry: 'software_internet',
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_topic: ['topic_career', 'topic_system_design'],
    have_skill: ['skill_figma', 'skill_typescript'],
    updated_at: '2026-11-14T00:00:00Z',
    ...overrides,
  });
}

const labelMap = new Map<string, string>([
  ['topic_career', '職涯諮詢'],
  ['topic_system_design', '系統設計'],
  ['topic_react', 'React'],
  ['skill_react', 'React'],
  ['skill_figma', 'Figma'],
  ['skill_typescript', 'TypeScript'],
]);

describe('buildMentorCardTags (#886)', () => {
  it('prioritizes active filter_topics and filter_skills by raw subject_group code before resolving localized labels', () => {
    const tags = buildMentorCardTags(
      {
        have_topic: ['topic_career', 'topic_system_design'],
        have_skill: ['skill_figma', 'skill_typescript'],
      },
      new Set(['skill_typescript']),
      labelMap
    );

    expect(tags).toEqual(['TypeScript', '職涯諮詢', '系統設計', 'Figma']);
  });

  it('deduplicates distinct raw codes across have_topic and have_skill that resolve to the same localized label', () => {
    const tags = buildMentorCardTags(
      {
        have_topic: ['topic_career', 'topic_react'],
        have_skill: ['skill_react', 'skill_typescript'],
      },
      new Set(['skill_react']),
      labelMap
    );

    expect(tags).toEqual(['React', '職涯諮詢', 'TypeScript']);
  });

  it('does not match localized label strings when prioritizedCodes holds raw subject_group codes', () => {
    // Only raw code `skill_typescript` is prioritized; passing localized label
    // `'Figma'` in prioritizedCodes must not match raw code `'skill_figma'`.
    const tags = buildMentorCardTags(
      {
        have_topic: ['topic_career'],
        have_skill: ['skill_figma', 'skill_typescript'],
      },
      new Set(['Figma']),
      labelMap
    );

    expect(tags).toEqual(['職涯諮詢', 'Figma', 'TypeScript']);
  });

  it('falls back to raw subject_group code when labelMap misses an entry', () => {
    const tags = buildMentorCardTags(
      {
        have_topic: ['topic_career'],
        have_skill: ['unknown_custom_skill'],
      },
      new Set(['unknown_custom_skill']),
      labelMap
    );

    expect(tags).toEqual(['unknown_custom_skill', '職涯諮詢']);
  });
});

describe('MentorCardList (#886)', () => {
  it('prioritizes active skill/topic filter badges by code and renders localized labels while ignoring industry badges', () => {
    const mentor = makeMentor(1, {
      have_topic: ['topic_career'],
      have_skill: ['skill_figma', 'skill_typescript'],
    });

    render(
      <MentorCardList
        mentors={[mentor]}
        onScrollToBottom={vi.fn(async () => {})}
        labelMap={labelMap}
        activeFilterBadges={[
          {
            key: 'filter_industries',
            name: '產業',
            value: 'topic_career',
            label: '職涯諮詢',
          },
          {
            key: 'filter_skills',
            name: '技能',
            value: 'skill_typescript',
            label: 'TypeScript',
          },
        ]}
      />
    );

    const displayContainer = screen.getByTestId('display-container');
    const renderedLabels = Array.from(displayContainer.children).map(
      (el) => el.textContent
    );
    expect(renderedLabels).toEqual(['TypeScript', '職涯諮詢', 'Figma']);
  });

  it('reuses cached tag label arrays per mentor across pagination appends so React.memo(MentorCard) props stay stable', () => {
    const mentor1 = makeMentor(1);
    const mentor2 = makeMentor(2);
    const mentor3 = makeMentor(3);
    const onScrollToBottom = vi.fn(async () => {});
    const badges = [
      {
        key: 'filter_skills',
        name: '技能',
        value: 'skill_typescript',
        label: 'TypeScript',
      },
    ];

    const { rerender } = render(
      <MentorCardList
        mentors={[mentor1, mentor2]}
        onScrollToBottom={onScrollToBottom}
        activeFilterBadges={badges}
        labelMap={labelMap}
      />
    );

    const firstCardBefore = screen.getAllByRole('article')[0];

    rerender(
      <MentorCardList
        mentors={[mentor1, mentor2, mentor3]}
        onScrollToBottom={onScrollToBottom}
        activeFilterBadges={badges}
        labelMap={labelMap}
      />
    );

    const articlesAfter = screen.getAllByRole('article');
    expect(articlesAfter).toHaveLength(3);
    expect(articlesAfter[0]).toBe(firstCardBefore);
  });

  it('supports comma-separated filter badge values and preserves tag cache across fresh activeFilterBadges array instances', () => {
    const mentor = makeMentor(1, {
      have_topic: ['topic_career'],
      have_skill: ['skill_figma', 'skill_typescript'],
    });
    const onScrollToBottom = vi.fn(async () => {});

    const { rerender } = render(
      <MentorCardList
        mentors={[mentor]}
        onScrollToBottom={onScrollToBottom}
        activeFilterBadges={[
          {
            key: 'filter_skills',
            name: '技能',
            value: 'skill_typescript, skill_figma',
            label: 'TypeScript, Figma',
          },
        ]}
        labelMap={labelMap}
      />
    );

    const displayContainer = screen.getByTestId('display-container');
    expect(
      Array.from(displayContainer.children).map((el) => el.textContent)
    ).toEqual(['Figma', 'TypeScript', '職涯諮詢']);

    // Rerender with a freshly allocated activeFilterBadges array containing the same codes
    rerender(
      <MentorCardList
        mentors={[mentor]}
        onScrollToBottom={onScrollToBottom}
        activeFilterBadges={[
          {
            key: 'filter_skills',
            name: '技能',
            value: 'skill_figma,skill_typescript',
            label: 'Figma, TypeScript',
          },
        ]}
        labelMap={labelMap}
      />
    );

    expect(
      Array.from(screen.getByTestId('display-container').children).map(
        (el) => el.textContent
      )
    ).toEqual(['Figma', 'TypeScript', '職涯諮詢']);
  });
});
