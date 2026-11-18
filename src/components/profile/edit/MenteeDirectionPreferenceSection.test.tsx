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
  initialPositions = ['frontend_engineer', 'backend_engineer'],
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

  const watchedSkill = form.watch('want_skill');
  const watchedTopic = form.watch('want_topic');

  return (
    <Form {...form}>
      <form>
        <MenteeDirectionPreferenceSection
          form={form}
          wantPositionCategories={POS_CATEGORIES}
          wantSkillCategories={SKILL_CATEGORIES}
          wantTopicCategories={TOPIC_CATEGORIES}
          directionMap={directionMap}
          onDirectionMapChange={setDirectionMap}
        />
        <output data-testid="flat-skills">{watchedSkill.join(',')}</output>
        <output data-testid="flat-topics">{watchedTopic.join(',')}</output>
      </form>
    </Form>
  );
}

describe('MenteeDirectionPreferenceSection (#828)', () => {
  it('shows empty guidance when no position direction is selected yet', () => {
    render(
      <Harness initialPositions={[]} initialSkills={[]} initialTopics={[]} />
    );

    expect(
      screen.getByText(/請先在上方選擇至少 1 個職位方向/)
    ).toBeInTheDocument();
  });

  it('retains independent skills and topics per direction tab and clears deselected direction items', () => {
    render(<Harness />);

    const tablist = screen.getByRole('tablist', { name: '職位方向' });
    const feTab = within(tablist).getByRole('tab', { name: '前端工程師' });
    const beTab = within(tablist).getByRole('tab', { name: '後端工程師' });

    expect(feTab).toHaveAttribute('aria-selected', 'true');

    // Switch to 後端工程師 tab and select Go skill + 模擬面試 topic
    fireEvent.click(beTab);
    expect(beTab).toHaveAttribute('aria-selected', 'true');

    const directionRegion = screen.getByTestId('mentee-direction-panel');
    // Expand skill and topic categories inside active direction panel
    const categoryTriggers = within(directionRegion).getAllByRole('button', {
      name: /軟體開發|職涯發展/,
    });
    categoryTriggers.forEach((btn) => fireEvent.click(btn));

    fireEvent.click(within(directionRegion).getByText('Go'));
    fireEvent.click(within(directionRegion).getByText('模擬面試'));

    expect(screen.getByTestId('flat-skills')).toHaveTextContent('react,go');
    expect(screen.getByTestId('flat-topics')).toHaveTextContent(
      'portfolio_guidance,interview_skills'
    );

    // Switch back to 前端工程師 tab -> React is still selected, Go is NOT selected under 前端工程師
    fireEvent.click(feTab);
    expect(feTab).toHaveAttribute('aria-selected', 'true');

    // Uncheck 前端工程師 in 有興趣多了解的職位 -> React and 履歷健檢 are cleared, while 後端工程師's Go & 模擬面試 remain!
    const posCategoryBtn = screen.getAllByRole('button', {
      name: /軟體開發/,
    })[0];
    fireEvent.click(posCategoryBtn);
    const positionCheckboxes = screen.getAllByText('前端工程師');
    fireEvent.click(positionCheckboxes[0]);

    expect(screen.getByTestId('flat-skills')).toHaveTextContent('go');
    expect(screen.getByTestId('flat-topics')).toHaveTextContent(
      'interview_skills'
    );
  });
});
