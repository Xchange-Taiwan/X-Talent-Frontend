import { render } from '@testing-library/react';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
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
  userDto: null,
  isMentor: false,
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
  AvatarSection: ({ id, isMentor }: { id?: string; isMentor?: boolean }) => (
    <div
      id={id}
      data-testid="avatar-section"
      data-is-mentor={String(isMentor)}
    />
  ),
}));
vi.mock('@/components/profile/edit/JobExperienceSection', () => ({
  JobExperienceSection: ({ isMentor }: { isMentor?: boolean }) => (
    <div
      data-testid="job-experience-section"
      data-is-mentor={String(isMentor)}
    />
  ),
}));
vi.mock('@/components/profile/edit/educationSection/educationSection', () => ({
  EducationSection: ({ isMentor }: { isMentor?: boolean }) => (
    <div data-testid="education-section" data-is-mentor={String(isMentor)} />
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
  Section: ({
    id,
    title,
    children,
    required = false,
  }: {
    id?: string;
    title?: React.ReactNode;
    children: React.ReactNode;
    required?: boolean;
  }) => (
    <div id={id} data-testid={`section-${id}`}>
      {title && (
        <span data-testid={`section-${id}-title`}>
          {required && '* '}
          {title}
        </span>
      )}
      {children}
    </div>
  ),
}));

vi.mock('@/components/profile/edit/LinkSection', () => ({
  LinksSection: () => <div data-testid="links-section" />,
}));

import * as useEditProfileFormModule from '@/hooks/user/profile/useEditProfileForm';
import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';
import { ProfileFormValues } from '@/schemas/profileSchema';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';
import { MentorProfileVO } from '@/services/profile/user';

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

    expect(mockUseProfileSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: false,
      })
    );
  });
});

describe('EditProfileContainer mentor-only section visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditProfileData.mockReturnValue({
      userDto: {} as unknown as MentorProfileVO,
      isMentor: false,
      isError: false,
    });
  });

  it('renders have_topic/have_skill sections during mentor onboarding even though isMentor (DB flag) is still false', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === MENTOR_ONBOARDING_KEY) return 'true';
      return null;
    });

    const { container } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(container.querySelector('#have_topic')).not.toBeNull();
    expect(container.querySelector('#have_skill')).not.toBeNull();
  });

  it('does not render have_topic/have_skill sections for a plain mentee (not onboarding, not a mentor)', () => {
    mockSearchParamsGet.mockImplementation(() => null);

    const { container } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(container.querySelector('#have_topic')).toBeNull();
    expect(container.querySelector('#have_skill')).toBeNull();
  });
});

describe('EditProfileContainer error handling and scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditProfileData.mockReturnValue({
      userDto: null,
      isMentor: false,
      isError: false,
    });
  });

  it('shows error screen when useEditProfileData returns isError: true', () => {
    mockUseEditProfileData.mockReturnValue({
      userDto: null,
      isMentor: false,
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
      userDto: {} as unknown as MentorProfileVO,
      isMentor: true,
      isError: false,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const getBoundingClientRectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.id === 'want_position') {
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
      const wantPositionEl = container.querySelector('#want_position');

      expect(nameEl).not.toBeNull();
      expect(wantPositionEl).not.toBeNull();

      const formEl = container.querySelector('form');
      if (formEl) {
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.submit(formEl);
      }

      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => {
        expect(scrolledIds.length).toBeGreaterThan(0);
      });

      // It should have scrolled to 'want_position' first because 150 < 300 (it's higher up in the layout)
      expect(scrolledIds[0]).toBe('want_position');
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>)
        .scrollIntoView;
      getBoundingClientRectSpy.mockRestore();
    }
  });

  it('does not crash or scroll if validation fails but corresponding DOM element does not exist', async () => {
    mockUseEditProfileData.mockReturnValue({
      userDto: {} as unknown as MentorProfileVO,
      isMentor: true,
      isError: false,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const getBoundingClientRectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
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

    const originalGetElementById = document.getElementById;
    document.getElementById = (id: string) => {
      if (id === 'about' || id === 'name') return null;
      return originalGetElementById.call(document, id);
    };

    try {
      const { container } = render(
        <EditProfileContainer
          pageUserId="1"
          initialTagCatalog={{} as unknown as TagCatalogsByBucket}
        />
      );

      const formEl = container.querySelector('form');
      if (formEl) {
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.submit(formEl);
      }

      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => {
        expect(scrolledIds).not.toContain('about');
        expect(scrolledIds).not.toContain('name');
      });
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>)
        .scrollIntoView;
      getBoundingClientRectSpy.mockRestore();
      document.getElementById = originalGetElementById;
    }
  });

  it('resets the form with mapped values when userDto is successfully fetched', () => {
    const mockUserDto = {
      id: 1,
      name: 'Loaded Test Name',
      is_mentor: false,
    };

    mockUseEditProfileData.mockReturnValue({
      userDto: mockUserDto,
      isMentor: false,
      isError: false,
    });

    const mockReset = vi.fn();
    const mockForm = {
      reset: mockReset,
      control: {},
      formState: { dirtyFields: {} },
      handleSubmit: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as UseFormReturn<ProfileFormValues>;

    const useEditProfileFormSpy = vi
      .spyOn(useEditProfileFormModule, 'useEditProfileForm')
      .mockReturnValue({ form: mockForm } as any);

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    // Verify form.reset was called with values mapped from mockUserDto
    expect(mockReset).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Loaded Test Name',
      })
    );

    useEditProfileFormSpy.mockRestore();
  });

  it('does not trigger form reset a second time when userDto updates after initial loading', () => {
    const mockUserDtoFirst = {
      user_id: 1,
      name: 'Initial Loaded Name',
      is_mentor: false,
    };

    const mockUserDtoSecond = {
      user_id: 1,
      name: 'Background Revalidated Name',
      is_mentor: false,
    };

    mockUseEditProfileData.mockReturnValue({
      userDto: mockUserDtoFirst,
      isMentor: false,
      isError: false,
    });

    const mockReset = vi.fn();
    const mockForm = {
      reset: mockReset,
      control: {},
      formState: { dirtyFields: {} },
      handleSubmit: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as UseFormReturn<ProfileFormValues>;

    const useEditProfileFormSpy = vi
      .spyOn(useEditProfileFormModule, 'useEditProfileForm')
      .mockReturnValue({ form: mockForm } as any);

    const { rerender } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Initial Loaded Name',
      })
    );

    // Mock background revalidation success
    mockUseEditProfileData.mockReturnValue({
      userDto: mockUserDtoSecond,
      isMentor: false,
      isError: false,
    });

    rerender(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    // It should not reset the form a second time
    expect(mockReset).toHaveBeenCalledTimes(1);

    useEditProfileFormSpy.mockRestore();
  });

  it('resets the form again when pageUserId route parameter switches to a different user', () => {
    const mockUserDtoFirst = {
      user_id: 1,
      name: 'User One Name',
      is_mentor: false,
    };

    const mockUserDtoSecond = {
      user_id: 2,
      name: 'User Two Name',
      is_mentor: false,
    };

    // 1) Render for first user
    mockUseEditProfileData.mockReturnValue({
      userDto: mockUserDtoFirst,
      isMentor: false,
      isError: false,
    });

    const mockReset = vi.fn();
    const mockForm = {
      reset: mockReset,
      control: {},
      formState: { dirtyFields: {} },
      handleSubmit: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as UseFormReturn<ProfileFormValues>;

    const useEditProfileFormSpy = vi
      .spyOn(useEditProfileFormModule, 'useEditProfileForm')
      .mockReturnValue({ form: mockForm } as any);

    const { rerender } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'User One Name',
      })
    );

    // 2) Re-render/routing switches to second user
    mockUseEditProfileData.mockReturnValue({
      userDto: mockUserDtoSecond,
      isMentor: false,
      isError: false,
    });

    rerender(
      <EditProfileContainer
        pageUserId="2"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    // It should trigger reset a second time since user ID has changed (from 1 to 2)!
    expect(mockReset).toHaveBeenCalledTimes(2);
    expect(mockReset).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'User Two Name',
      })
    );

    useEditProfileFormSpy.mockRestore();
  });
});

describe('EditProfileContainer isMentorRole logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      onboardingParam: 'true',
      isMentorDb: false,
      expectedIsMentor: true,
      desc: 'when isMentorOnboarding is true',
    },
    {
      onboardingParam: null,
      isMentorDb: true,
      expectedIsMentor: true,
      desc: 'when isMentor is true',
    },
    {
      onboardingParam: null,
      isMentorDb: false,
      expectedIsMentor: false,
      desc: 'when both isMentorOnboarding and isMentor are false',
    },
  ])(
    'correctly propagates parameters and displays hints $desc',
    ({ onboardingParam, isMentorDb, expectedIsMentor }) => {
      mockSearchParamsGet.mockImplementation((key) => {
        if (key === MENTOR_ONBOARDING_KEY) return onboardingParam;
        return null;
      });

      mockUseEditProfileData.mockReturnValue({
        userDto: { user_id: 1, name: 'Test' } as unknown as MentorProfileVO,
        isMentor: isMentorDb,
        isError: false,
      });

      const useEditProfileFormSpy = vi.spyOn(
        useEditProfileFormModule,
        'useEditProfileForm'
      );

      const { getByTestId, queryByTestId } = render(
        <EditProfileContainer
          pageUserId="1"
          initialTagCatalog={{} as unknown as TagCatalogsByBucket}
        />
      );

      // Verify useEditProfileForm parameter passing
      expect(useEditProfileFormSpy).toHaveBeenCalledWith(expectedIsMentor);

      // Verify child props
      expect(getByTestId('avatar-section')).toHaveAttribute(
        'data-is-mentor',
        String(expectedIsMentor)
      );
      expect(getByTestId('job-experience-section')).toHaveAttribute(
        'data-is-mentor',
        String(expectedIsMentor)
      );
      expect(getByTestId('education-section')).toHaveAttribute(
        'data-is-mentor',
        String(expectedIsMentor)
      );

      if (expectedIsMentor) {
        // Verify asterisks on about and industry sections
        expect(getByTestId('section-about-title')).toHaveTextContent(
          '* 關於我'
        );
        expect(getByTestId('section-industry-title')).toHaveTextContent(
          '* 產業'
        );

        // Verify mentor-only sections render
        expect(queryByTestId('section-have_topic')).toBeInTheDocument();
        expect(queryByTestId('section-have_skill')).toBeInTheDocument();
      } else {
        // Verify NO asterisks on about and industry sections
        expect(getByTestId('section-about-title')).not.toHaveTextContent('*');
        expect(getByTestId('section-industry-title')).not.toHaveTextContent(
          '*'
        );

        // Verify mentor-only sections do NOT render
        expect(queryByTestId('section-have_topic')).not.toBeInTheDocument();
        expect(queryByTestId('section-have_skill')).not.toBeInTheDocument();
      }

      useEditProfileFormSpy.mockRestore();
    }
  );
});
