import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: '1' } },
    status: 'authenticated',
    update: vi.fn(),
  }),
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
  JobExperienceSection: () => <div data-testid="job-experience-section" />,
}));
vi.mock('@/components/profile/edit/educationSection/educationSection', () => ({
  EducationSection: () => <div data-testid="education-section" />,
}));

import EditProfileContainer from './container';

const emptyCatalog = fromPartial<TagCatalogsByBucket>({});

function createValidBaseUserDto(
  experiences: MentorProfileVO['experiences']
): MentorProfileVO {
  return fromPartial<MentorProfileVO>({
    user_id: 1,
    name: 'Test User',
    location: 'TWN',
    years_of_experience: '1_3',
    is_mentor: false,
    want_position: ['frontend'],
    want_skill: ['typescript'],
    want_topic: ['career'],
    experiences,
  });
}

describe('EditProfileContainer schema-driven period validation & scroll guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops submission and scrolls to work_experiences when a work experience has start > end period', async () => {
    mockCommitProfileMutation.mockResolvedValue({});
    mockUseUserProfileDto.mockReturnValue({
      userDto: createValidBaseUserDto([
        {
          category: ExperienceType.WORK,
          order: 1,
          mentor_experiences_metadata: fromAny({
            data: [
              {
                job: 'Engineer',
                company: 'Acme',
                job_period_start: '2025',
                job_period_end: '2021',
                industry: 'TECH',
                job_location: 'TWN',
                description: 'Building systems',
                is_primary: true,
              },
            ],
          }),
        },
      ]),
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { container } = render(
      <EditProfileContainer pageUserId="1" initialTagCatalog={emptyCatalog} />
    );

    await screen.findByLabelText('LinkedIn');
    const formEl = container.querySelector('form')!;

    fireEvent.submit(formEl);

    await waitFor(() => {
      expect(scrolledIds).toContain('work_experiences');
    });
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();
  });

  it('stops submission and scrolls to educations when an education entry has start > end period', async () => {
    mockCommitProfileMutation.mockResolvedValue({});
    mockUseUserProfileDto.mockReturnValue({
      userDto: createValidBaseUserDto([
        {
          category: ExperienceType.EDUCATION,
          order: 2,
          mentor_experiences_metadata: fromAny({
            data: [
              {
                subject: '資訊工程學系',
                school: '國立臺灣大學',
                education_period_start: '2025',
                education_period_end: '2021',
              },
            ],
          }),
        },
      ]),
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { container } = render(
      <EditProfileContainer pageUserId="1" initialTagCatalog={emptyCatalog} />
    );

    await screen.findByLabelText('LinkedIn');
    const formEl = container.querySelector('form')!;

    fireEvent.submit(formEl);

    await waitFor(() => {
      expect(scrolledIds).toContain('educations');
    });
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();
  });

  it('stops submission, renders platform error, and scrolls to links when links.linkedin is invalid', async () => {
    mockCommitProfileMutation.mockResolvedValue({});
    mockUseUserProfileDto.mockReturnValue({
      userDto: createValidBaseUserDto([]),
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { container } = render(
      <EditProfileContainer pageUserId="1" initialTagCatalog={emptyCatalog} />
    );

    const linkedinInput = await screen.findByLabelText('LinkedIn');
    fireEvent.change(linkedinInput, {
      target: { value: 'https://evil-linkedin.com/in/test' },
    });

    const formEl = container.querySelector('form')!;
    fireEvent.submit(formEl);

    await waitFor(() => {
      expect(scrolledIds).toContain('links');
    });
    expect(
      await screen.findByText(
        '請輸入有效的 LinkedIn HTTPS 網址（允許網域：linkedin.com）'
      )
    ).toBeInTheDocument();
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();
  });

  it('stops submission, renders GitHub domain error, and scrolls to links when links.github is not github.com (#862)', async () => {
    mockCommitProfileMutation.mockResolvedValue({});
    mockUseUserProfileDto.mockReturnValue({
      userDto: createValidBaseUserDto([]),
      error: null,
    });

    const scrolledIds: string[] = [];
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      if (this.id) scrolledIds.push(this.id);
    };

    const { container } = render(
      <EditProfileContainer pageUserId="1" initialTagCatalog={emptyCatalog} />
    );

    const githubInput = await screen.findByLabelText('GitHub');
    fireEvent.change(githubInput, {
      target: { value: 'https://gitlab.com/octocat' },
    });

    const formEl = container.querySelector('form')!;
    fireEvent.submit(formEl);

    await waitFor(() => {
      expect(scrolledIds).toContain('links');
    });
    expect(
      await screen.findByText(
        '請輸入有效的 GitHub HTTPS 網址（允許網域：github.com）'
      )
    ).toBeInTheDocument();
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();
  });
});
