import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

const mockUseUserProfileDto = vi.fn();
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: (...args: unknown[]) => mockUseUserProfileDto(...args),
}));

const mockCommitProfileMutation = vi.fn();
vi.mock('@/lib/profile/saveProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/profile/saveProfile')>();
  return {
    ...actual,
    commitProfileMutation: (...args: unknown[]) =>
      mockCommitProfileMutation(...args),
  };
});

vi.mock('@/hooks/user/country/useLocations', () => ({
  default: () => ({
    locations: [{ value: 'TWN', text: '台灣 (Taiwan)' }],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  default: () => ({
    industry: [{ subject_group: 'TECH', subject: '科技 / 軟體' }],
    want_position: [
      {
        subject_group: 'software_dev',
        subject: '軟體開發',
        language: 'zh_TW',
        leaves: [
          {
            subject_group: 'frontend_engineer',
            subject: '前端工程師',
            language: 'zh_TW',
          },
        ],
      },
    ],
    want_skill: [
      {
        subject_group: 'software_dev',
        subject: '軟體開發',
        language: 'zh_TW',
        leaves: [
          { subject_group: 'react', subject: 'React', language: 'zh_TW' },
        ],
      },
    ],
    want_topic: [
      {
        subject_group: 'career',
        subject: '職涯發展',
        language: 'zh_TW',
        leaves: [
          {
            subject_group: 'interview_skills',
            subject: '面試技巧',
            language: 'zh_TW',
          },
        ],
      },
    ],
    have_skill: [],
    have_topic: [],
  }),
}));

import { readStoredMenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';

import { MenteeInPlaceEditor } from './MenteeInPlaceEditor';

describe('MenteeInPlaceEditor (#828 B-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 42,
        name: '林小英',
        avatar: '',
        is_mentor: false,
        onboarding: true,
        location: 'TWN',
        years_of_experience: '3_5',
        industry: { subject_group: 'TECH', subject: '科技 / 軟體' },
        about: '準備轉職前端工程師',
        job_title: 'UI/UX 設計師',
        company: '新創科技',
        want_position: ['frontend_engineer'],
        want_skill: ['react'],
        want_topic: ['interview_skills'],
        have_skill: [],
        have_topic: [],
        experiences: [
          {
            category: 'WORK',
            order: 1,
            mentor_experiences_metadata: {
              data: [
                {
                  job: 'UI/UX 設計師',
                  company: '新創科技',
                  job_period_start: '2022',
                  job_period_end: 'now',
                  industry: 'TECH',
                  job_location: 'TWN',
                  description: '負責產品介面設計',
                  is_primary: true,
                },
              ],
            },
          },
        ],
      },
      error: null,
    });
  });

  it('renders top & bottom 取消/儲存, 6 Mentee sections, collapsed summary rows, and zero Mentor-only fields or asterisks', () => {
    render(<MenteeInPlaceEditor pageUserId="42" onExitEdit={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: '取消' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '儲存' })).toHaveLength(2);

    expect(screen.getByLabelText('姓名')).toHaveValue('林小英');
    expect(screen.getByText('3/20')).toBeInTheDocument();
    expect(screen.getAllByText(/UI\/UX 設計師/)).toHaveLength(2);

    // 6 sections present
    expect(screen.getByText('基本資料')).toBeInTheDocument();
    expect(screen.getByText('關於我')).toBeInTheDocument();
    expect(screen.getByText('交流偏好')).toBeInTheDocument();
    expect(screen.getByText('工作經驗')).toBeInTheDocument();
    expect(screen.getByText('教育')).toBeInTheDocument();
    expect(screen.getByText('個人連結')).toBeInTheDocument();

    // Zero Mentor-only fields or Mentor required asterisks
    expect(screen.queryByText('我能提供的服務')).not.toBeInTheDocument();
    expect(screen.queryByText('專業能力')).not.toBeInTheDocument();
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('saves preset avatar /avatars/default_4.webp without S3 upload, persists direction map, and exits edit mode', async () => {
    const onExitEdit = vi.fn();
    mockCommitProfileMutation.mockImplementation(
      async (_intent, _ctx, port: { navigate: (href: string) => void }) => {
        port.navigate('/profile/42');
        return {
          user_id: 42,
          name: '林小英',
          avatar: '/avatars/default_4.webp',
        };
      }
    );

    render(<MenteeInPlaceEditor pageUserId="42" onExitEdit={onExitEdit} />);

    // Open avatar dialog, pick preset 4, confirm dialog
    fireEvent.click(screen.getByRole('button', { name: '編輯個人頭像' }));
    fireEvent.click(await screen.findByRole('button', { name: '預設頭像 4' }));
    fireEvent.click(screen.getByRole('button', { name: '儲存頭像' }));

    // Save form
    fireEvent.click(screen.getAllByRole('button', { name: '儲存' })[0]);

    await waitFor(() => {
      expect(mockCommitProfileMutation).toHaveBeenCalledTimes(1);
    });

    const submittedIntent = mockCommitProfileMutation.mock.calls[0][0];
    expect(submittedIntent.values.avatar).toBe('/avatars/default_4.webp');
    expect(submittedIntent.values.avatarFile).toBeUndefined();
    expect(readStoredMenteeDirectionMap('42')).toEqual({
      frontend_engineer: {
        skills: ['react'],
        topics: ['interview_skills'],
      },
    });
    expect(onExitEdit).toHaveBeenCalledTimes(1);
  });

  it('prompts unsaved-changes confirmation when cancelling with dirty modifications', async () => {
    const onExitEdit = vi.fn();
    render(<MenteeInPlaceEditor pageUserId="42" onExitEdit={onExitEdit} />);

    fireEvent.change(screen.getByLabelText('姓名'), {
      target: { value: '林小英更新' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: '取消' })[0]);

    expect(onExitEdit).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: '尚未儲存的變更' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '離開頁面' }));
    expect(onExitEdit).toHaveBeenCalledTimes(1);
  });
});
