import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

import { MentorWelcomeFlipCard } from './MentorWelcomeFlipCard';

describe('MentorWelcomeFlipCard (#961)', () => {
  const mentorData = fromPartial<UserType>({
    user_id: 101,
    name: 'Zahra Mirzakhani',
    avatar: 'https://example.com/zahra.jpg',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX',
    about: '樂意陪你梳理作品集與職涯下一步。',
    location: '臺灣',
    years_of_experience: 'FIVE_TO_TEN_YEARS',
    is_mentor: true,
    have_topic: [
      { subject_group: 'portfolio', subject: '作品集檢視' },
      { subject_group: 'career', subject: '職涯規劃' },
    ],
    have_skill: [{ subject_group: 'ux', subject: 'UX Research' }],
  });

  it('renders front face without L1 badge and flips to welcome back face on click and keyboard Enter/Space without double-toggling', async () => {
    const user = userEvent.setup();
    render(<MentorWelcomeFlipCard userData={mentorData} />);

    const frontFace = screen.getByTestId('mentor-card-front');
    const backFace = screen.getByTestId('mentor-card-back');
    expect(frontFace).toHaveAttribute('aria-hidden', 'false');
    expect(backFace).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('MENTOR')).toBeInTheDocument();
    expect(screen.queryByText('L1')).not.toBeInTheDocument();
    expect(screen.getByText('Zahra Mirzakhani')).toBeInTheDocument();
    expect(
      screen.getByText('Senior UX Designer at CreativeUX')
    ).toBeInTheDocument();
    expect(screen.getByText('作品集檢視 · 職涯規劃')).toBeInTheDocument();
    expect(screen.getByText('UX Research')).toBeInTheDocument();
    expect(screen.getByText('臺灣 · 5–10 年經驗')).toBeInTheDocument();

    const flipSurface = screen.getByTestId('mentor-welcome-flip-card');
    await user.click(flipSurface);

    expect(flipSurface).toHaveAttribute('aria-pressed', 'true');
    expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    expect(backFace).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('WELCOME TO X-TALENT')).toBeInTheDocument();
    expect(screen.getByText(/很高興/)).toBeInTheDocument();
    expect(screen.getByText(/讓經驗成為連結/)).toBeInTheDocument();

    // Native <button> keyboard Enter and Space via userEvent (synthesizing real click events)
    flipSurface.focus();
    await user.keyboard('{Enter}');
    expect(flipSurface).toHaveAttribute('aria-pressed', 'false');
    expect(frontFace).toHaveAttribute('aria-hidden', 'false');

    await user.keyboard(' ');
    expect(flipSurface).toHaveAttribute('aria-pressed', 'true');
    expect(backFace).toHaveAttribute('aria-hidden', 'false');
  });

  it('triggers onEditProfile via sibling button without flipping card and disables 編輯資料 while flipped to back face (#961)', () => {
    const onEditProfile = vi.fn();
    render(
      <MentorWelcomeFlipCard
        userData={mentorData}
        onEditProfile={onEditProfile}
      />
    );

    const frontFace = screen.getByTestId('mentor-card-front');
    const flipBtn = screen.getByTestId('mentor-welcome-flip-card');
    const editBtn = screen.getByRole('button', { name: '編輯資料' });

    // Sibling buttons (no WAI-ARIA nested interactive elements)
    expect(flipBtn.contains(editBtn)).toBe(false);

    fireEvent.click(editBtn);
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(frontFace).toHaveAttribute('aria-hidden', 'false');

    // Flip to back -> 編輯資料 exits keyboard tab order (disabled & tabIndex=-1)
    fireEvent.click(flipBtn);
    expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    expect(editBtn).toBeDisabled();
    expect(editBtn).toHaveAttribute('tabIndex', '-1');
  });
});
