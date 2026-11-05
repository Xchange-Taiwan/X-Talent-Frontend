import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';

import ProfileCardUI from './ui';

vi.mock('@/components/profile/profile-card', () => ({
  ProfileCard: ({ name }: { name: string }) => (
    <div data-testid="profile-card">{name}</div>
  ),
}));

const mockUserData = fromPartial<UserType>({
  name: 'Alice Chen',
  avatar: 'https://example.com/avatar.png',
  job_title: 'Frontend Engineer',
  company: 'XChange',
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
  personalLinks: [],
  is_mentor: false,
});

describe('ProfileCardUI (#804)', () => {
  it('renders localized Traditional Chinese subtitle and "成為導師" / "開始探索 X-Talent" buttons for mentees', () => {
    const onBecomeMentor = vi.fn();
    const onGoToMentorPool = vi.fn();
    const onBackToProfile = vi.fn();

    render(
      <ProfileCardUI
        userData={mockUserData}
        isMentor={false}
        linkedinUrl="https://linkedin.com/in/alice"
        onBecomeMentor={onBecomeMentor}
        onGoToMentorPool={onGoToMentorPool}
        onBackToProfile={onBackToProfile}
      />
    );

    expect(screen.getByText('恭喜你完成個人頁面的建立！')).toBeInTheDocument();
    expect(
      screen.getByText('現在你可以開始探索導師，或只需一步即可建立你的導師檔案')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Now you can explore mentors or build your mentor profile/i
      )
    ).not.toBeInTheDocument();

    const becomeMentorBtn = screen.getByRole('button', { name: '成為導師' });
    const exploreBtn = screen.getByRole('button', {
      name: '開始探索 X-Talent',
    });

    fireEvent.click(becomeMentorBtn);
    expect(onBecomeMentor).toHaveBeenCalledTimes(1);

    fireEvent.click(exploreBtn);
    expect(onGoToMentorPool).toHaveBeenCalledTimes(1);
  });

  it('renders mentor completion view and "返回我的個人頁面" button when isMentor is true', () => {
    const onBecomeMentor = vi.fn();
    const onGoToMentorPool = vi.fn();
    const onBackToProfile = vi.fn();

    render(
      <ProfileCardUI
        userData={{ ...mockUserData, is_mentor: true }}
        isMentor={true}
        linkedinUrl="https://linkedin.com/in/alice"
        onBecomeMentor={onBecomeMentor}
        onGoToMentorPool={onGoToMentorPool}
        onBackToProfile={onBackToProfile}
      />
    );

    expect(screen.getByText('恭喜！')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '成為導師' })
    ).not.toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: '返回我的個人頁面' });
    fireEvent.click(backBtn);
    expect(onBackToProfile).toHaveBeenCalledTimes(1);
  });
});
