import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { OnboardingRole } from '@/schemas/profileSchema';

import { RoleSelectorCards } from './RoleSelectorCards';

function Harness() {
  const [role, setRole] = useState<OnboardingRole>('mentee');
  return <RoleSelectorCards value={role} onChange={setRole} />;
}

describe('RoleSelectorCards (#836 A-4)', () => {
  it('toggles between Mentee and Mentor role cards and opens info popover', () => {
    render(<Harness />);

    const menteeBtn = screen.getByTestId('onboarding-role-mentee');
    const mentorBtn = screen.getByTestId('onboarding-role-mentor');

    expect(menteeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(mentorBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mentorBtn);
    expect(mentorBtn).toHaveAttribute('aria-pressed', 'true');
    expect(menteeBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '雙軌身分說明' }));
    expect(screen.getByText(/完成導師資料後即為 L1 導師/)).toBeInTheDocument();
  });
});
