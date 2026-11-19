import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { Category } from '@/components/ui/category-multi-select';
import { Form } from '@/components/ui/form';
import {
  hydrateMenteeDirectionMap,
  type MenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';
import {
  createProfileFormSchema,
  defaultValues,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';

import { MenteeDirectionPreferenceSection } from './MenteeDirectionPreferenceSection';

const POS_CATEGORIES: Category[] = [
  {
    key: 'software_dev',
    label: '軟體開發',
    options: [
      { value: 'frontend_engineer', label: '前端工程師' },
      { value: 'backend_engineer', label: '後端工程師' },
    ],
  },
];

const SKILL_CATEGORIES: Category[] = [
  {
    key: 'software_dev',
    label: '軟體開發',
    options: [
      { value: 'react', label: 'React' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'go', label: 'Go' },
    ],
  },
];

const TOPIC_CATEGORIES: Category[] = [
  {
    key: 'career',
    label: '職涯發展',
    options: [
      { value: 'portfolio_guidance', label: '履歷健檢' },
      { value: 'interview_skills', label: '模擬面試' },
    ],
  },
];

function Harness({
  initialPositions = ['frontend_engineer'],
  initialSkills = ['react'],
  initialTopics = ['portfolio_guidance'],
}: {
  initialPositions?: string[];
  initialSkills?: string[];
  initialTopics?: string[];
}) {
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(false)),
    defaultValues: {
      ...defaultValues,
      name: '陳小華',
      want_position: initialPositions,
      want_skill: initialSkills,
      want_topic: initialTopics,
    },
  });

  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>(() =>
    hydrateMenteeDirectionMap({
      positions: initialPositions,
      flatSkills: initialSkills,
      flatTopics: initialTopics,
    })
  );

  const watchedPos = form.watch('want_position');
  const watchedSkill = form.watch('want_skill');
  const watchedTopic = form.watch('want_topic');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => undefined)}>
        <MenteeDirectionPreferenceSection
          form={form}
          wantPositionCategories={POS_CATEGORIES}
          wantSkillCategories={SKILL_CATEGORIES}
          wantTopicCategories={TOPIC_CATEGORIES}
          directionMap={directionMap}
          onDirectionMapChange={setDirectionMap}
        />
        <output data-testid="flat-positions">{watchedPos.join(',')}</output>
        <output data-testid="flat-skills">{watchedSkill.join(',')}</output>
        <output data-testid="flat-topics">{watchedTopic.join(',')}</output>
        <button type="submit">送出驗證</button>
      </form>
    </Form>
  );
}

describe('MenteeDirectionPreferenceSection (#828 / #959 / #966)', () => {
  it('hides direction tabs when no position is selected and shows 已選 0 / 1', () => {
    render(
      <Harness initialPositions={[]} initialSkills={[]} initialTopics={[]} />
    );

    expect(screen.getByText('已選 0 / 1')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('switches single-selected position cleanly, clears previous direction tags, and blocks submit if new direction has 0 skills and 0 topics', async () => {
    render(<Harness />);

    const tablist = screen.getByRole('tablist', { name: '職位方向' });
    expect(
      within(tablist).getByRole('tab', { name: '前端工程師' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('flat-skills')).toHaveTextContent('react');

    // Open position picker and switch to 後端工程師 (single-select replaces 前端工程師)
    fireEvent.click(screen.getByRole('button', { name: '新增職位' }));
    fireEvent.click(screen.getByRole('button', { name: /軟體開發/ }));
    fireEvent.click(screen.getByText('後端工程師'));

    expect(screen.getByTestId('flat-positions')).toHaveTextContent(
      'backend_engineer'
    );
    expect(screen.getByTestId('flat-skills')).toHaveTextContent('');
    expect(screen.getByTestId('flat-topics')).toHaveTextContent('');

    // Submitting with 後端工程師 selected and 0 skills & 0 topics must fail validation!
    fireEvent.click(screen.getByRole('button', { name: '送出驗證' }));
    expect(
      await screen.findByText(
        '已選擇職位方向時，請至少選擇一項想加強的技能或想了解的主題'
      )
    ).toBeInTheDocument();

    // Selecting Go skill clears validation error
    fireEvent.click(screen.getByRole('button', { name: '新增技能' }));
    fireEvent.click(screen.getByRole('button', { name: /軟體開發/ }));
    fireEvent.click(screen.getByText('Go'));
    expect(screen.getByTestId('flat-skills')).toHaveTextContent('go');
  });
});
