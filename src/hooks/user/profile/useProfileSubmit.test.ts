import { act, renderHook } from '@testing-library/react';
import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/services/profile/upsertExperience', () => ({
  upsertMentorExperience: vi.fn(),
}));

vi.mock('@/lib/profile/pollUntilSynced', () => ({
  pollUntilSynced: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/useUserData', () => ({
  clearUserDataCache: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { defaultValues } from '@/components/profile/edit/profileSchema';
import { pollUntilSynced } from '@/lib/profile/pollUntilSynced';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { upsertMentorExperience } from '@/services/profile/upsertExperience';
import { UserDTO } from '@/services/profile/user';
import { mockRouter } from '@/test/mocks/navigation';

import { useProfileSubmit } from './useProfileSubmit';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockUpdateProfile = vi.mocked(updateProfile);
const mockUpsertMentorExperience = vi.mocked(upsertMentorExperience);
const mockPollUntilSynced = vi.mocked(pollUntilSynced);

const mockUserDTO: UserDTO = {
  user_id: 1,
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  job_title: 'Engineer',
  company: 'Acme',
  years_of_experience: '1_3',
  location: 'Taiwan',
  interested_positions: { interests: [], language: null },
  skills: { interests: [], language: null },
  topics: { interests: [], language: null },
  industry: {
    id: 1,
    category: 'tech',
    subject_group: 'tech',
    subject: 'software',
    language: 'zh_TW',
    profession_metadata: { desc: '', icon: '' },
  },
  onboarding: true,
  is_mentor: true,
  language: 'zh_TW',
};

const mockSession: Session = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    onBoarding: true,
    isMentor: true,
  },
  accessToken: 'mock-token',
  expires: '2099-01-01T00:00:00.000Z',
};

const baseValues = {
  ...defaultValues,
  name: 'Test User',
  location: 'Taiwan',
  years_of_experience: '1_3',
  interested_positions: ['engineer'],
  skills: ['TypeScript'],
  topics: ['frontend'],
};

const makeOptions = (
  overrides: Partial<Parameters<typeof useProfileSubmit>[0]> = {}
) => ({
  pageUserId: 'test-user-id',
  isMentorOnboarding: false,
  session: mockSession,
  updateSession: vi.fn().mockResolvedValue(mockSession),
  jobSectionError: false,
  educationSectionError: false,
  ...overrides,
});

describe('useProfileSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockUpsertMentorExperience.mockResolvedValue(undefined);
    mockPollUntilSynced.mockResolvedValue(mockUserDTO);
  });

  // ── Guard clauses ──────────────────────────────────────────────────────────

  it('jobSectionError: true → returns early, no service is called', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ jobSectionError: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockUpsertMentorExperience).not.toHaveBeenCalled();
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
  });

  it('educationSectionError: true → returns early, no service is called', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ educationSectionError: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockUpsertMentorExperience).not.toHaveBeenCalled();
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
  });

  // ── Avatar upload ──────────────────────────────────────────────────────────

  it('no avatarFile → updateAvatar is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: undefined });
    });

    expect(mockUpdateAvatar).not.toHaveBeenCalled();
  });

  it('avatarFile present + upload succeeds → returned URL is used in profile payload', async () => {
    const newAvatarUrl = 'https://example.com/new-avatar.jpg';
    mockUpdateAvatar.mockResolvedValueOnce(newAvatarUrl);

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(mockUpdateAvatar).toHaveBeenCalledWith(file);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: newAvatarUrl })
    );
  });

  it('avatarFile present + updateAvatar throws → isSaving returns to false', async () => {
    mockUpdateAvatar.mockRejectedValueOnce(new Error('Upload failed'));

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── Service failures ───────────────────────────────────────────────────────

  it('updateProfile throws → isSaving returns to false', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Profile update failed'));

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(result.current.isSaving).toBe(false);
  });

  it('upsertMentorExperience throws → isSaving returns to false', async () => {
    mockUpsertMentorExperience.mockRejectedValueOnce(
      new Error('Upsert failed')
    );

    const valuesWithWork = {
      ...baseValues,
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2020',
          jobPeriodEnd: '2023',
          industry: 'tech',
          jobLocation: 'Taiwan',
          description: 'Built things',
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithWork);
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── Conditional upserts ────────────────────────────────────────────────────

  it('work_experiences is empty → work experience upsert is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, work_experiences: [] });
    });

    const workCalls = mockUpsertMentorExperience.mock.calls.filter(
      ([type]) => type === ExperienceType.WORK
    );
    expect(workCalls).toHaveLength(0);
  });

  it('educations is empty → education upsert is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, educations: [] });
    });

    const educationCalls = mockUpsertMentorExperience.mock.calls.filter(
      ([type]) => type === ExperienceType.EDUCATION
    );
    expect(educationCalls).toHaveLength(0);
  });

  // ── Navigation on success ──────────────────────────────────────────────────

  it('isMentorOnboarding: false → router.push("/profile/:pageUserId")', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(
        makeOptions({ isMentorOnboarding: false, pageUserId: 'test-user-id' })
      )
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/test-user-id');
  });

  it('isMentorOnboarding: true → router.push("/profile/card")', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ isMentorOnboarding: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/card');
  });
});
