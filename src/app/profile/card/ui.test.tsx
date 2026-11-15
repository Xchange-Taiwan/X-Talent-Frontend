import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import type { PersonalLink } from '@/lib/profile/socialLinks';

import ProfileCardUI from './ui';

const mockProfileCard = vi.fn();
vi.mock('@/components/profile/profile-card', () => ({
  ProfileCard: (props: { name: string; personalLinks?: PersonalLink[] }) => {
    mockProfileCard(props);
    return <div data-testid="profile-card">{props.name}</div>;
  },
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
  personalLinks: [{ platform: 'website', url: 'https://alicechen.dev' }],
  is_mentor: false,
});

describe('ProfileCardUI (#804, #898)', () => {
  beforeEach(() => {
    mockProfileCard.mockClear();
  });

  it('renders localized Traditional Chinese subtitle, forwards personalLinks, and triggers mentee CTA buttons', () => {
    const onBecomeMentor = vi.fn();
    const onGoToMentorPool = vi.fn();
    const onBackToProfile = vi.fn();
    const explicitLinks: PersonalLink[] = [
      { platform: 'linkedin', url: 'https://linkedin.com/in/alice' },
      { platform: 'twitter', url: 'https://x.com/alice' },
    ];

    render(
      <ProfileCardUI
        userData={mockUserData}
        isMentor={false}
        personalLinks={explicitLinks}
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
    expect(mockProfileCard).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice Chen',
        personalLinks: explicitLinks,
      })
    );

    const becomeMentorBtn = screen.getByRole('button', { name: '成為導師' });
    const exploreBtn = screen.getByRole('button', {
      name: '開始探索 X-Talent',
    });

    fireEvent.click(becomeMentorBtn);
    expect(onBecomeMentor).toHaveBeenCalledTimes(1);

    fireEvent.click(exploreBtn);
    expect(onGoToMentorPool).toHaveBeenCalledTimes(1);
  });

  it('renders mentor completion view, falls back to userData.personalLinks when personalLinks prop is omitted, and handles back navigation', () => {
    const onBecomeMentor = vi.fn();
    const onGoToMentorPool = vi.fn();
    const onBackToProfile = vi.fn();

    render(
      <ProfileCardUI
        userData={{ ...mockUserData, is_mentor: true }}
        isMentor={true}
        onBecomeMentor={onBecomeMentor}
        onGoToMentorPool={onGoToMentorPool}
        onBackToProfile={onBackToProfile}
      />
    );

    expect(screen.getByText('恭喜！')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '成為導師' })
    ).not.toBeInTheDocument();
    expect(mockProfileCard).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice Chen',
        personalLinks: mockUserData.personalLinks,
      })
    );

    const backBtn = screen.getByRole('button', { name: '返回我的個人頁面' });
    fireEvent.click(backBtn);
    expect(onBackToProfile).toHaveBeenCalledTimes(1);
  });
});
