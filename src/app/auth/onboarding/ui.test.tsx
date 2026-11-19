import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: '1', name: 'Test User', avatar: '' } },
    status: 'authenticated',
  }),
}));

import type { MenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import {
  formSchema,
  onboardingDefaultValues,
  type OnboardingFormInput,
  type OnboardingFormValues,
  type OnboardingRole,
} from '@/schemas/onboarding';
import type { TagCatalogGroupVO } from '@/types/tagCatalog';

import OnboardingUI from './ui';

const SAMPLE_GROUPS: TagCatalogGroupVO[] = [
  {
    language: 'zh_TW',
    subject_group: 'software',
    subject: '軟體開發',
    leaves: [
      {
        tag_id: 1,
        language: 'zh_TW',
        subject_group: 'fe',
        subject: '前端工程師',
      },
    ],
  },
];

function Harness({
  initialRole = 'mentee',
  initialDirectionMap = {},
  initialPositions = [],
  initialSkills = [],
  initialTopics = [],
  onInspectForm,
}: {
  initialRole?: OnboardingRole;
  initialDirectionMap?: MenteeDirectionMap;
  initialPositions?: string[];
  initialSkills?: string[];
  initialTopics?: string[];
  onInspectForm?: (values: OnboardingFormInput) => void;
}) {
  const form = useForm<OnboardingFormInput, unknown, OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...onboardingDefaultValues,
      role: initialRole,
      name: '陳大明',
      want_position: initialPositions,
      want_skill: initialSkills,
      want_topic: initialTopics,
    },
  });
  const [directionMap, setDirectionMap] =
    useState<MenteeDirectionMap>(initialDirectionMap);
  const role = form.watch('role') ?? initialRole;

  const watchedPos = form.watch('want_position');
  const watchedSkill = form.watch('want_skill');
  const watchedTopic = form.watch('want_topic');
  onInspectForm?.(form.getValues());

  return (
    <>
      <OnboardingUI
        role={role}
        onRoleChange={(next) => form.setValue('role', next)}
        form={form}
        locations={[{ value: 'TWN', text: '台灣' }]}
        industries={[{ subject_group: 'TECH', subject: '科技業' }]}
        haveTopicGroups={SAMPLE_GROUPS}
        haveSkillGroups={SAMPLE_GROUPS}
        wantPositionGroups={SAMPLE_GROUPS}
        wantSkillGroups={SAMPLE_GROUPS}
        wantTopicGroups={SAMPLE_GROUPS}
        directionMap={directionMap}
        onDirectionMapChange={setDirectionMap}
        onAvatarFileChange={() => {}}
        onSelectPresetAvatar={(code) => form.setValue('avatar', code)}
        isSubmitting={false}
        onSubmit={async () => {
          await form.trigger();
        }}
      />
      <output data-testid="flat-positions">{watchedPos.join(',')}</output>
      <output data-testid="flat-skills">{watchedSkill.join(',')}</output>
      <output data-testid="flat-topics">{watchedTopic.join(',')}</output>
    </>
  );
}

describe('OnboardingUI single-page dual-role (#836 A-4)', () => {
  it('switches immediately between Mentee fields and Mentor dynamic sub-sections on a single page', async () => {
    render(<Harness />);

    expect(
      screen.getByRole('heading', { name: '該如何稱呼你呢？' })
    ).toBeInTheDocument();
    expect(screen.getByText('有興趣多了解的職位')).toBeInTheDocument();
    expect(
      screen.queryByText('我已閱讀並同意導師規範')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-role-mentor'));

    expect(screen.getByText('我已閱讀並同意導師規範')).toBeInTheDocument();
    expect(screen.getByText('關於我')).toBeInTheDocument();
    expect(screen.getByText('服務與專長')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('工作經驗')).toBeInTheDocument();
      expect(screen.getByText('教育經歷')).toBeInTheDocument();
      expect(screen.getByText('個人連結')).toBeInTheDocument();
    });
    expect(screen.queryByText('有興趣多了解的職位')).not.toBeInTheDocument();
  });

  it('clears skills and topics associated with a position direction when that position is unchecked', () => {
    render(
      <Harness
        initialPositions={['fe']}
        initialSkills={['fe']}
        initialTopics={['fe']}
        initialDirectionMap={{ fe: { skills: ['fe'], topics: ['fe'] } }}
      />
    );

    expect(screen.getByTestId('flat-positions')).toHaveTextContent('fe');
    expect(screen.getByTestId('flat-skills')).toHaveTextContent('fe');
    expect(screen.getByTestId('flat-topics')).toHaveTextContent('fe');

    fireEvent.click(screen.getByRole('button', { name: '新增職位' }));
    fireEvent.click(screen.getByRole('button', { name: /軟體開發/ }));
    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByTestId('flat-positions')).toHaveTextContent('');
    expect(screen.getByTestId('flat-skills')).toHaveTextContent('');
    expect(screen.getByTestId('flat-topics')).toHaveTextContent('');
  });
});
