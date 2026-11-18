import { fireEvent, render, screen } from '@testing-library/react';
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
    years_of_experience: '5~10 年',
    is_mentor: true,
    have_topic: [
      { subject_group: 'portfolio', subject: '作品集檢視' },
      { subject_group: 'career', subject: '職涯規劃' },
    ],
    have_skill: [{ subject_group: 'ux', subject: 'UX Research' }],
  });

  it('renders front face without L1 badge and flips to welcome back face on click with 3D CSS transition', () => {
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
    expect(screen.getByText('臺灣 · 5~10 年經驗')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mentor-welcome-flip-card'));

    expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    expect(backFace).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('WELCOME TO X-TALENT')).toBeInTheDocument();
    expect(screen.getByText(/很高興/)).toBeInTheDocument();
    expect(screen.getByText(/讓經驗成為連結/)).toBeInTheDocument();
  });
});
