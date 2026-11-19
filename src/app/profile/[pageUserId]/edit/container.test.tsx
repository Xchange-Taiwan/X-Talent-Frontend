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
const mockUseUserProfileDto = vi.fn().mockReturnValue({
  userDto: null,
  error: null,
});
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: (...args: unknown[]) => mockUseUserProfileDto(...args),
}));

const mockCommitProfileMutation = vi.fn().mockResolvedValue({});
vi.mock('@/lib/profile/saveProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/profile/saveProfile')>();
  return {
    ...actual,
    commitProfileMutation: (...args: unknown[]) =>
      mockCommitProfileMutation(...args),
  };
});

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
  TextField: ({ name }: { name?: string }) => {
    const ctx = useFormContextMock(name);
    return <div data-testid={`textfield-${name ?? ''}`} data-value={ctx} />;
  },
  TextareaField: () => <div />,
  SelectField: () => <div />,
  ComboboxField: () => <div />,
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

import { useFormContext } from 'react-hook-form';

import * as useProfileEditorSessionModule from '@/hooks/user/profile/useProfileEditorSession';
import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import { MentorProfileVO } from '@/types/user';

import EditProfileContainer from './container';

function useFormContextMock(name?: string): string {
  const form = useFormContext();
  if (!form || !name) return '';
  const val = form.watch(name);
  return typeof val === 'string' ? val : '';
}

describe('EditProfileContainer isMentorOnboarding parsing', () => {
  it('correctly parses isMentorOnboarding as true when query param is true', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === MENTOR_ONBOARDING_KEY) return 'true';
      return null;
    });

    const spy = vi.spyOn(
      useProfileEditorSessionModule,
      'useProfileEditorSession'
    );

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );
    spy.mockRestore();
  });

  it('correctly parses isMentorOnboarding as true when the legacy onboarding query param is true (backwards compatibility)', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === 'onboarding') return 'true';
      return null;
    });

    const spy = vi.spyOn(
      useProfileEditorSessionModule,
      'useProfileEditorSession'
    );

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: true,
      })
    );
    spy.mockRestore();
  });

  it('correctly parses isMentorOnboarding as false when query param is absent', () => {
    mockSearchParamsGet.mockImplementation(() => null);

    const spy = vi.spyOn(
      useProfileEditorSessionModule,
      'useProfileEditorSession'
    );

    render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        isMentorOnboarding: false,
      })
    );
    spy.mockRestore();
  });
});

describe('EditProfileContainer mentor-only section visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserProfileDto.mockReturnValue({
      userDto: { is_mentor: false } as unknown as MentorProfileVO,
      error: null,
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
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      error: null,
    });
  });

  it('shows error screen when useUserProfileDto returns fatal error without userDto', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      error: new Error('500 failed'),
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
    mockUseUserProfileDto.mockReturnValue({
      userDto: { is_mentor: true } as unknown as MentorProfileVO,
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const getBoundingClientRectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.id === 'location') {
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
      const locationEl = container.querySelector('#location');

      expect(nameEl).not.toBeNull();
      expect(locationEl).not.toBeNull();

      const formEl = container.querySelector('form');
      if (formEl) {
        const { fireEvent } = await import('@testing-library/react');
        fireEvent.submit(formEl);
      }

      const { waitFor } = await import('@testing-library/react');
      await waitFor(() => {
        expect(scrolledIds.length).toBeGreaterThan(0);
      });

      // It should have scrolled to 'location' first because 150 < 300 (it's higher up in the layout)
      expect(scrolledIds[0]).toBe('location');
    } finally {
      delete (Element.prototype as unknown as Record<string, unknown>)
        .scrollIntoView;
      getBoundingClientRectSpy.mockRestore();
    }
  });

  it('does not crash or scroll if validation fails but corresponding DOM element does not exist', async () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: { is_mentor: true } as unknown as MentorProfileVO,
      error: null,
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
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 1,
        name: 'Loaded Test Name',
        is_mentor: false,
      },
      error: null,
    });

    const { getByTestId } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByTestId('textfield-name')).toHaveAttribute(
      'data-value',
      'Loaded Test Name'
    );
  });

  it('does not trigger form reset a second time when userDto updates after initial loading', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 1,
        name: 'Initial Loaded Name',
        is_mentor: false,
      },
      error: null,
    });

    const { getByTestId, rerender } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByTestId('textfield-name')).toHaveAttribute(
      'data-value',
      'Initial Loaded Name'
    );

    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 1,
        name: 'Background Revalidated Name',
        is_mentor: false,
      },
      error: null,
    });

    rerender(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByTestId('textfield-name')).toHaveAttribute(
      'data-value',
      'Initial Loaded Name'
    );
  });

  it('resets the form again when pageUserId route parameter switches to a different user', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 1,
        name: 'User One Name',
        is_mentor: false,
      },
      error: null,
    });

    const { getByTestId, rerender } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByTestId('textfield-name')).toHaveAttribute(
      'data-value',
      'User One Name'
    );

    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        user_id: 2,
        name: 'User Two Name',
        is_mentor: false,
      },
      error: null,
    });

    rerender(
      <EditProfileContainer
        pageUserId="2"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    expect(getByTestId('textfield-name')).toHaveAttribute(
      'data-value',
      'User Two Name'
    );
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

      mockUseUserProfileDto.mockReturnValue({
        userDto: {
          user_id: 1,
          name: 'Test',
          is_mentor: isMentorDb,
        } as unknown as MentorProfileVO,
        error: null,
      });

      const { getByTestId, queryByTestId } = render(
        <EditProfileContainer
          pageUserId="1"
          initialTagCatalog={{} as unknown as TagCatalogsByBucket}
        />
      );

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
        // Verify asterisks on about, location, years_of_experience, and industry sections
        expect(getByTestId('section-about-title')).toHaveTextContent(
          '* 關於我'
        );
        expect(getByTestId('section-location-title')).toHaveTextContent(
          '* 地區'
        );
        expect(
          getByTestId('section-years_of_experience-title')
        ).toHaveTextContent('* 經驗');
        expect(getByTestId('section-industry-title')).toHaveTextContent(
          '* 產業'
        );

        // Verify mentor-only sections render and mentee preferences are hidden
        expect(queryByTestId('section-have_topic')).toBeInTheDocument();
        expect(queryByTestId('section-have_skill')).toBeInTheDocument();
        expect(queryByTestId('section-want_position')).not.toBeInTheDocument();
      } else {
        // Verify NO asterisks on about, location, years_of_experience, and industry sections
        expect(getByTestId('section-about-title')).not.toHaveTextContent('*');
        expect(getByTestId('section-location-title')).not.toHaveTextContent(
          '*'
        );
        expect(
          getByTestId('section-years_of_experience-title')
        ).not.toHaveTextContent('*');
        expect(getByTestId('section-industry-title')).not.toHaveTextContent(
          '*'
        );

        // Verify mentor-only sections do NOT render and mentee direction preferences render
        expect(queryByTestId('section-have_topic')).not.toBeInTheDocument();
        expect(queryByTestId('section-have_skill')).not.toBeInTheDocument();
        expect(queryByTestId('section-want_position')).toBeInTheDocument();
      }
    }
  );
});
