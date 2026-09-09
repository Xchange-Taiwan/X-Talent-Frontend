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

const mockUseEditProfileData = vi.fn().mockReturnValue({
  userDto: null,
  isMentor: false,
  isError: false,
});
vi.mock('@/hooks/user/profile/useEditProfileData', () => ({
  useEditProfileData: (options: unknown) => mockUseEditProfileData(options),
}));

vi.mock('@/hooks/user/profile/useProfileSubmit', () => ({
  useProfileSubmit: () => ({ onSubmit: vi.fn(), isSaving: false }),
}));

vi.mock('@/hooks/user/auth/useProfileAuth', () => ({
  useProfileAuth: () => ({ isAuthorized: true }),
}));

vi.mock('@/hooks/user/profile/useBackgroundAvatarUpload', () => ({
  useBackgroundAvatarUpload: () => ({
    kickOff: vi.fn(),
    rollback: vi.fn(),
    consume: vi.fn(),
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
  Section: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
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
    mockUseEditProfileData.mockReturnValue({
      userDto: {} as unknown as MentorProfileVO,
      isMentor: false,
      isError: false,
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
});
