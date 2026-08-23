import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import { MentorProfileVO } from '@/types/user';

// mock navigate & searchParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

// mock session
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: '1' } }, update: vi.fn() }),
}));

// mock other hooks to isolate our container test
const mockUseEditProfileData = vi.fn().mockReturnValue({
  userDto: { user_id: 1, name: 'Test User' } as unknown as MentorProfileVO,
  isMentor: false,
  isError: false,
});
vi.mock('@/hooks/user/profile/useEditProfileData', () => ({
  useEditProfileData: () => mockUseEditProfileData(),
}));

const mockUseProfileSubmit = vi.fn().mockReturnValue({
  onSubmit: vi.fn(),
  isSaving: false,
});
vi.mock('@/hooks/user/profile/useProfileSubmit', () => ({
  useProfileSubmit: () => mockUseProfileSubmit(),
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

// Mock the form hook to bypass dynamic validations & directly invoke the onSuccess submit handler
const mockForm = {
  reset: vi.fn(),
  control: {},
  formState: { dirtyFields: {} },
  handleSubmit: vi.fn().mockImplementation((onSuccess) => (e: unknown) => {
    const ev = e as { preventDefault?: () => void } | undefined;
    if (ev && ev.preventDefault) ev.preventDefault();
    return onSuccess({});
  }),
};
vi.mock('@/hooks/user/profile/useEditProfileForm', () => ({
  useEditProfileForm: () => ({ form: mockForm }),
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
  ComboboxField: () => <div />,
}));
vi.mock('@/components/profile/edit/CategoryMultiSelectField', () => ({
  CategoryMultiSelectField: () => <div />,
}));
vi.mock('@/components/profile/edit/Section', () => ({
  Section: ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <div id={id}>{children}</div>
  ),
}));

vi.mock('@/components/profile/edit/JobExperienceSection', () => ({
  JobExperienceSection: ({
    onValidationChange,
  }: {
    onValidationChange: (err: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="trigger-job-error"
      onClick={() => onValidationChange(true)}
    >
      Trigger Job Error
    </button>
  ),
}));

vi.mock('@/components/profile/edit/educationSection/educationSection', () => ({
  EducationSection: ({
    onValidationChange,
  }: {
    onValidationChange: (err: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="trigger-edu-error"
      onClick={() => onValidationChange(true)}
    >
      Trigger Edu Error
    </button>
  ),
}));

vi.mock('@/components/profile/edit/LinkSection', () => ({
  LinksSection: ({ id }: { id?: string }) => (
    <div id={id} data-testid="links-section" />
  ),
}));

import EditProfileContainer from './container';

describe('EditProfileContainer section validation guards (Isolated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops submission and scrolls to work_experiences if jobSectionError is true', async () => {
    const mockOnSubmit = vi.fn();
    mockUseProfileSubmit.mockReturnValue({
      onSubmit: mockOnSubmit,
      isSaving: false,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { getByTestId, container } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    const triggerBtn = await waitFor(() => getByTestId('trigger-job-error'));
    fireEvent.click(triggerBtn);

    const formEl = container.querySelector('form');
    expect(formEl).not.toBeNull();
    fireEvent.submit(formEl!);

    await waitFor(() => {
      expect(scrolledIds).toContain('work_experiences');
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('stops submission and scrolls to educations if educationSectionError is true', async () => {
    const mockOnSubmit = vi.fn();
    mockUseProfileSubmit.mockReturnValue({
      onSubmit: mockOnSubmit,
      isSaving: false,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { getByTestId, container } = render(
      <EditProfileContainer
        pageUserId="1"
        initialTagCatalog={{} as unknown as TagCatalogsByBucket}
      />
    );

    const triggerBtn = await waitFor(() => getByTestId('trigger-edu-error'));
    fireEvent.click(triggerBtn);

    const formEl = container.querySelector('form');
    expect(formEl).not.toBeNull();
    fireEvent.submit(formEl!);

    await waitFor(() => {
      expect(scrolledIds).toContain('educations');
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
