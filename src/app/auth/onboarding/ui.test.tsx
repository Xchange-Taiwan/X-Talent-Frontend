import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen } from '@testing-library/react';
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
    key: 'software',
    subject_group: 'software',
    subject: '軟體開發',
    leaves: [{ subject_group: 'fe', subject: '前端工程師' }],
  } as unknown as TagCatalogGroupVO,
];

function Harness({ initialRole = 'mentee' }: { initialRole?: OnboardingRole }) {
  const form = useForm<OnboardingFormInput, unknown, OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...onboardingDefaultValues,
      role: initialRole,
      name: '陳大明',
    },
  });
  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>({});
  const role = form.watch('role') ?? initialRole;

  return (
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
  );
}

describe('OnboardingUI single-page dual-role (#836 A-4)', () => {
  it('switches immediately between Mentee fields and Mentor fields on a single page', async () => {
    render(<Harness />);

    expect(
      screen.getByRole('heading', { name: '該如何稱呼你呢？' })
    ).toBeInTheDocument();
    expect(screen.getByText('有興趣多了解的職位')).toBeInTheDocument();
    expect(
      screen.queryByText('我已閱讀並同意導師規範')
    ).not.toBeInTheDocument();

    // Switch to Mentor -> immediately displays guidelines, 關於我, and 服務與專長
    fireEvent.click(screen.getByTestId('onboarding-role-mentor'));

    expect(screen.getByText('我已閱讀並同意導師規範')).toBeInTheDocument();
    expect(screen.getByText('關於我')).toBeInTheDocument();
    expect(screen.getByText('服務與專長')).toBeInTheDocument();
    expect(screen.queryByText('有興趣多了解的職位')).not.toBeInTheDocument();
  });
});
