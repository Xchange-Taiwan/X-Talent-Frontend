import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// This file intentionally does NOT mock @/hooks/useUnsavedChangesPrompt or
// @/components/profile/edit/EditPageHeader (unlike container.test.tsx), so at
// least one test exercises the real interception logic wired into the real
// page, not the fully-mocked hook.

const mockPush = vi.fn();
const mockSearchParamsGet = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: '1' } }, update: vi.fn() }),
}));

const mockUseUserProfileDto = vi.fn().mockReturnValue({
  userDto: null,
  error: null,
});
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: (...args: unknown[]) => mockUseUserProfileDto(...args),
}));

vi.mock('@/lib/profile/saveProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/profile/saveProfile')>();
  return {
    ...actual,
    commitProfileMutation: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@/hooks/user/auth/useProfileAuth', () => ({
  useProfileAuth: () => ({ isAuthorized: true }),
}));

vi.mock('@/hooks/user/profile/useBackgroundAvatarUpload', () => ({
  useBackgroundAvatarUpload: () => ({
    stage: vi.fn(),
    kickOff: vi.fn(),
    resolve: vi.fn(),
    markCommitted: vi.fn(),
    rollback: vi.fn(),
    abort: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/user/country/useLocations', () => ({
  default: () => ({ locations: [] }),
}));

vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  default: () => ({
    industry: [],
    have_topic: [],
    have_skill: [],
    want_position: [],
    want_skill: [],
    want_topic: [],
  }),
}));

vi.mock('@/components/profile/edit/AvatarSection', () => ({
  AvatarSection: () => <div data-testid="avatar-section" />,
}));
vi.mock('@/components/profile/edit/JobExperienceSection', () => ({
  JobExperienceSection: () => <div data-testid="job-experience-section" />,
}));
vi.mock('@/components/profile/edit/educationSection/educationSection', () => ({
  EducationSection: () => <div data-testid="education-section" />,
}));
// Keep TextField/TextareaField real (needed to actually dirty the form) but
// stub the heavier Radix-backed Select/Combobox fields.
vi.mock('@/components/profile/edit/Fields', async (importActual) => {
  const actual =
    await importActual<typeof import('@/components/profile/edit/Fields')>();
  return {
    ...actual,
    SelectField: () => <div />,
    ComboboxField: () => <div />,
  };
});
vi.mock('@/components/profile/edit/CategoryMultiSelectField', () => ({
  CategoryMultiSelectField: () => <div />,
}));
vi.mock('@/components/profile/edit/Section', () => ({
  Section: ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <div id={id}>{children}</div>
  ),
}));
vi.mock('@/components/profile/edit/LinkSection', () => ({
  LinksSection: () => <div data-testid="links-section" />,
}));

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import EditProfileContainer from './container';

describe('EditProfileContainer unsaved-changes interception (integration, real hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockUseUserProfileDto.mockReturnValue({
      userDto: {} as unknown as MentorProfileVO,
      error: null,
    });
  });

  it('intercepts leaving via the header back/cancel button once the form is dirty, using the real useUnsavedChangesPrompt hook', async () => {
    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    // Dirty the form through a real, unmocked field.
    const nameInput = await screen.findByPlaceholderText('請填入您的姓名');
    fireEvent.change(nameInput, { target: { value: 'Jonas' } });
    await waitFor(() => expect(nameInput).toHaveValue('Jonas'));

    const cancelButton = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelButton);

    // Real interception: the confirm dialog opens instead of navigating away.
    expect(await screen.findByText('尚未儲存的變更')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    // Cancel leaving: dialog closes, stays on the page, input untouched.
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
    await waitFor(() =>
      expect(screen.queryByText('尚未儲存的變更')).not.toBeInTheDocument()
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue('Jonas');

    // Trigger the prompt again and confirm leaving this time.
    fireEvent.click(cancelButton);
    expect(await screen.findByText('尚未儲存的變更')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '離開頁面' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/1'));
  });

  it('scrolls to #name and blocks navigation when Mentee submits with empty name (#959)', async () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 1,
        name: '陳小華',
        is_mentor: false,
        want_position: [],
        want_skill: [],
        want_topic: [],
      } as unknown as MentorProfileVO,
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    try {
      const { container } = render(
        <EditProfileContainer
          pageUserId="1"
          initialTagCatalog={{} as unknown as TagCatalogsByBucket}
        />
      );

      const nameInput = await screen.findByPlaceholderText('請填入您的姓名');
      fireEvent.change(nameInput, { target: { value: '' } });

      fireEvent.submit(container.querySelector('form')!);

      await waitFor(() => {
        expect(scrolledIds).toContain('name');
      });

      fireEvent.click(screen.getByRole('button', { name: '取消' }));
      expect(await screen.findByText('尚未儲存的變更')).toBeInTheDocument();
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>)
        .scrollIntoView;
    }
  });
});
