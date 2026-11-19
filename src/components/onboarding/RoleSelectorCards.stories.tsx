import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import type { OnboardingRole } from '@/schemas/onboarding';

import { RoleSelectorCards } from './RoleSelectorCards';

function ControlledRoleDemo({ initialRole }: { initialRole: OnboardingRole }) {
  const [role, setRole] = useState<OnboardingRole>(initialRole);
  return (
    <div className="max-w-2xl p-6">
      <RoleSelectorCards value={role} onChange={setRole} />
    </div>
  );
}

const meta: Meta<typeof RoleSelectorCards> = {
  title: '業務模組元件/新手引導(Onboarding)/RoleSelectorCards',
  component: RoleSelectorCards,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RoleSelectorCards>;

export const MenteeSelected: Story = {
  render: () => <ControlledRoleDemo initialRole="mentee" />,
};

export const MentorSelected: Story = {
  render: () => <ControlledRoleDemo initialRole="mentor" />,
};
