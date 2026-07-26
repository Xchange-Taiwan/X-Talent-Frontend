import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// mock navigate & searchParams
const mockSearchParamsGet = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

// mock session
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: '1' } }, update: vi.fn() }),
}));

// mock other hooks to isolate our container test
const mockUseEditProfileData = vi.fn();
vi.mock('@/hooks/user/profile/useEditProfileData', () => ({
  useEditProfileData: (options: unknown) => mockUseEditProfileData(options),
}));

const mockUseProfileSubmit = vi
  .fn()
  .mockReturnValue({ onSubmit: vi.fn(), isSaving: false });
vi.mock('@/hooks/user/profile/useProfileSubmit', () => ({
  useProfileSubmit: (options: unknown) => mockUseProfileSubmit(options),
}));

const mockUseProfileAuth = vi.fn().mockReturnValue({ isAuthorized: true });
vi.mock('@/hooks/user/auth/useProfileAuth', () => ({
  useProfileAuth: () => mockUseProfileAuth(),
}));

vi.mock('@/hooks/user/profile/useBackgroundAvatarUpload', () => ({
  useBackgroundAvatarUpload: () => ({
    kickOff: vi.fn(),
    rollback: vi.fn(),
    consume: vi.fn(),
  }),
}));

vi.mock('@/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: () => ({
    isPromptOpen: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
    guardNavigate: vi.fn(),
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

// Mock the child sections so the form renders with zero issues
vi.mock('@/components/profile/edit/EditPageHeader', () => ({
  EditPageHeader: () => <div data-testid="edit-header" />,
}));
vi.mock('@/components/profile/edit/AvatarSection', () => ({
  AvatarSection: () => <div data-testid="avatar-section" />,
}));
vi.mock('@/components/profile/edit/Fields', () => ({
  TextField: () => <div />,
  TextareaField: () => <div />,
  SelectField: () => <div />,
}));
vi.mock('@/components/profile/edit/CategoryMultiSelectField', () => ({
  CategoryMultiSelectField: () => <div />,
}));
vi.mock('@/components/profile/edit/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';

import EditProfileContainer from './container';

describe('EditProfileContainer isMentorOnboarding parsing', () => {
  it('correctly parses isMentorOnboarding as true when query param is true', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === MENTOR_ONBOARDING_KEY) return 'true';
      return null;
    });

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    // Check that useEditProfileData was called with isMentorOnboarding: true
    expect(mockUseEditProfileData).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );

    // Check that useProfileSubmit was called with isMentorOnboarding: true
    expect(mockUseProfileSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );
  });

  it('correctly parses isMentorOnboarding as true when the legacy onboarding query param is true (backwards compatibility)', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === 'onboarding') return 'true';
      return null;
    });

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(mockUseEditProfileData).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );

    expect(mockUseProfileSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );
  });

  it('correctly parses isMentorOnboarding as false when query param is absent', () => {
    mockSearchParamsGet.mockImplementation(() => null);

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(mockUseEditProfileData).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: false,
      })
    );

    expect(mockUseProfileSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: false,
      })
    );
  });
});
