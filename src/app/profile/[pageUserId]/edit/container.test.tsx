import { render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const mockUseEditProfileData = vi.fn().mockReturnValue({
  isMentor: false,
  isPageLoading: false,
  isError: false,
});
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
  AvatarSection: ({ id }: { id?: string }) => (
    <div id={id} data-testid="avatar-section" />
  ),
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
  Section: ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <div id={id}>{children}</div>
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

describe('EditProfileContainer error handling and scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditProfileData.mockReturnValue({
      isMentor: false,
      isPageLoading: false,
      isError: false,
    });
  });

  it('shows error screen when useEditProfileData returns isError: true', () => {
    mockUseEditProfileData.mockReturnValue({
      isMentor: false,
      isPageLoading: false,
      isError: true,
    });

    const { getByText } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByText('載入失敗，請稍後再試。')).toBeInTheDocument();
  });

  it('triggers scroll to the correct topmost error element when validation fails', async () => {
    mockUseEditProfileData.mockReturnValue({
      isMentor: true,
      isPageLoading: false,
      isError: false,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const getBoundingClientRectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.id === 'about') {
          return {
            top: 150,
            left: 0,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        if (this.id === 'name') {
          return {
            top: 300,
            left: 0,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          } as DOMRect;
        }
        return {
          top: 9999,
          left: 0,
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      });

    try {
      const { container } = render(
        <EditProfileContainer
          pageUserId="1"
          initialTagCatalog={{} as unknown as TagCatalogsByBucket}
        />
      );

      const nameEl = container.querySelector('#name');
      const aboutEl = container.querySelector('#about');

      expect(nameEl).not.toBeNull();
      expect(aboutEl).not.toBeNull();

      const formEl = container.querySelector('form');
      if (formEl) {
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.submit(formEl);
      }

      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => {
        expect(scrolledIds.length).toBeGreaterThan(0);
      });

      // It should have scrolled to 'about' first because 150 < 300 (it's higher up in the layout)
      expect(scrolledIds[0]).toBe('about');
    } finally {
      delete (Element.prototype as any).scrollIntoView;
      getBoundingClientRectSpy.mockRestore();
    }
  });
});
