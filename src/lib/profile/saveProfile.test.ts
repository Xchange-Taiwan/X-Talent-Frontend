import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import {
  getUserProfileDtoFromCache,
  primeUserProfileDtoCache,
  userProfileDtoReadManager,
} from '@/lib/cache/userProfileDtoCache';
import {
  EMPTY_MENTOR_POOL_STATE,
  type MentorPoolQuery,
  mentorPoolReadModel,
  UNFILTERED_MENTOR_POOL_QUERY,
} from '@/lib/mentor/mentorPoolReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { ExperienceType } from '@/services/profile/experienceType';
import { baseValues, mockSession, mockUserDTO } from '@/test/fixtures/profile';
import type { MentorType } from '@/types/mentor';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import {
  type ProfileSavePort,
  saveProfile,
  type SaveProfileContext,
} from './saveProfile';

const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const FAST_TEST_BUDGET: SaveProfileContext['convergenceBudget'] = {
  fastFetchTimeoutMs: 50,
  profileMaxRetries: 2,
  profileIntervalMs: 0,
  searchIndexMaxRetries: 2,
  searchIndexIntervalMs: 0,
};

type ProfileSaveSpies = {
  [K in keyof Required<ProfileSavePort>]: ReturnType<
    typeof vi.fn<NonNullable<ProfileSavePort[K]>>
  >;
};

function makeSyncedDtoFromValues(
  overrides: Partial<MentorProfileVO> = {}
): MentorProfileVO {
  return {
    ...mockUserDTO,
    user_id: 1,
    name: baseValues.name,
    avatar: baseValues.avatar ?? mockUserDTO.avatar,
    location: baseValues.location ?? null,
    personal_statement: baseValues.statement ?? null,
    about: baseValues.about ?? null,
    years_of_experience: baseValues.years_of_experience ?? null,
    industry: baseValues.industry
      ? fromAny({
          id: 1,
          kind: 'industry',
          subject_group: baseValues.industry,
          subject: '軟體與科技',
          language: 'zh_TW',
        })
      : null,
    ...overrides,
  };
}

function makeSyncedMentorCard(overrides: Partial<MentorType> = {}): MentorType {
  return fromPartial<MentorType>({
    user_id: 1,
    name: baseValues.name,
    job_title: '',
    company: '',
    about: baseValues.about ?? '',
    years_of_experience: String(baseValues.years_of_experience ?? ''),
    have_topic: baseValues.have_topic ?? [],
    have_skill: baseValues.have_skill ?? [],
    avatar: baseValues.avatar ?? '',
    ...overrides,
  });
}

function createInMemoryProfileSavePort(
  overrides: Partial<ProfileSaveSpies> = {}
) {
  const uploadAvatar =
    overrides.uploadAvatar ??
    vi.fn<NonNullable<ProfileSavePort['uploadAvatar']>>(
      async () =>
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000'
    );
  const writeProfile =
    overrides.writeProfile ??
    vi.fn<NonNullable<ProfileSavePort['writeProfile']>>(async () => undefined);
  const fetchProfile =
    overrides.fetchProfile ??
    vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(async () =>
      makeSyncedDtoFromValues()
    );
  const searchMentors =
    overrides.searchMentors ??
    vi.fn<NonNullable<ProfileSavePort['searchMentors']>>(async () => [
      makeSyncedMentorCard(),
    ]);
  const updateSession =
    overrides.updateSession ??
    vi.fn<ProfileSavePort['updateSession']>(async () => mockSession);
  const revalidateProfilePath =
    overrides.revalidateProfilePath ??
    vi.fn<ProfileSavePort['revalidateProfilePath']>(async () => undefined);
  const navigate = overrides.navigate ?? vi.fn<ProfileSavePort['navigate']>();

  const port: ProfileSavePort = {
    uploadAvatar,
    writeProfile,
    fetchProfile,
    searchMentors,
    updateSession,
    revalidateProfilePath,
    navigate,
  };

  return {
    port,
    spies: {
      uploadAvatar,
      writeProfile,
      fetchProfile,
      searchMentors,
      updateSession,
      revalidateProfilePath,
      navigate,
    },
  };
}

function makeContext(
  overrides: Partial<SaveProfileContext> = {}
): SaveProfileContext {
  return {
    pageUserId: '1',
    isMentorOnboarding: false,
    session: mockSession,
    convergenceBudget: FAST_TEST_BUDGET,
    ...overrides,
  };
}

describe('saveProfile (Deep Module with ProfileSavePort)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userProfileDtoReadManager.clear();
    mentorPoolReadModel.clear();
  });

  afterEach(() => {
    userProfileDtoReadManager.clear();
    mentorPoolReadModel.clear();
  });

  // ── Avatar upload & versioned S3 URL flow ──────────────────────────────────

  it('does not call uploadAvatar when avatarFile is absent', async () => {
    const { port, spies } = createInMemoryProfileSavePort();

    await saveProfile(
      { ...baseValues, avatarFile: undefined },
      makeContext(),
      port
    );

    expect(spies.uploadAvatar).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('uploads avatarFile via ProfileSavePort, writes versioned URL to profile, primes userProfileDtoCache synchronously, and converges against &cb= search-index card', async () => {
    const uploadedUrl =
      'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000';
    const { port, spies } = createInMemoryProfileSavePort({
      uploadAvatar: vi.fn<NonNullable<ProfileSavePort['uploadAvatar']>>(
        async () => uploadedUrl
      ),
      fetchProfile: vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
        async () =>
          makeSyncedDtoFromValues({
            avatar: uploadedUrl,
          })
      ),
      searchMentors: vi.fn<NonNullable<ProfileSavePort['searchMentors']>>(
        async () => [
          makeSyncedMentorCard({
            avatar: `${uploadedUrl}&cb=2026-11-14T00%3A00%3A00Z`,
          }),
        ]
      ),
    });

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const result = await saveProfile(
      { ...baseValues, avatarFile: file },
      makeContext(),
      port
    );

    expect(spies.uploadAvatar).toHaveBeenCalledWith(file, 1);
    expect(spies.writeProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ avatar: uploadedUrl })
    );
    expect(result.avatar).toBe(uploadedUrl);
    expect(getUserProfileDtoFromCache(1, 'zh_TW')?.avatar).toBe(uploadedUrl);

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('reports avatar_upload failure and throws LoggedError when uploadAvatar rejects, without clearing mentorPoolReadModel', async () => {
    mentorPoolReadModel.set(
      UNFILTERED_MENTOR_POOL_QUERY,
      mentorPoolReadModel.buildInitialUnfilteredState({
        initialMentors: [makeSyncedMentorCard()],
        initialNextCursor: null,
        initialMentorCount: 1,
      })
    );

    const { port } = createInMemoryProfileSavePort({
      uploadAvatar: vi.fn<NonNullable<ProfileSavePort['uploadAvatar']>>(
        async () => {
          throw new Error('Upload failed');
        }
      ),
    });

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    await expect(
      saveProfile({ ...baseValues, avatarFile: file }, makeContext(), port)
    ).rejects.toThrow('Upload failed');

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'avatar_upload',
        message: 'Upload failed',
      })
    );
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)?.mentors
    ).toHaveLength(1);
  });

  it('reports profile_write failure and throws LoggedError when writeProfile rejects', async () => {
    const { port } = createInMemoryProfileSavePort({
      writeProfile: vi.fn<NonNullable<ProfileSavePort['writeProfile']>>(
        async () => {
          throw new Error('Profile update failed');
        }
      ),
    });

    await expect(saveProfile(baseValues, makeContext(), port)).rejects.toThrow(
      'Profile update failed'
    );

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'profile_write',
        message: 'Profile update failed',
      })
    );
  });

  // ── Optimistic industryCatalog resolution & is_primary mirroring ───────────

  it('resolves newly edited industry code against industryCatalog instead of copying stale currentDto.industry.subject', async () => {
    const industryCatalog: IndustryOption[] = [
      { subject_group: 'tech', subject: '軟體與科技' },
      { subject_group: 'finance', subject: '金融與銀行' },
    ];
    const currentDto = fromPartial<MentorProfileVO>({
      ...mockUserDTO,
      user_id: 1,
      industry: fromAny({
        id: 10,
        kind: 'industry',
        subject_group: 'tech',
        subject: '軟體與科技',
        language: 'zh_TW',
      }),
    });

    // Hold background fetch open so we inspect the synchronous optimistic DTO in cache
    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch = resolve;
          })
      ),
    });

    const optimisticDto = await saveProfile(
      {
        ...baseValues,
        industry: 'finance',
      },
      makeContext({
        currentDto,
        industryCatalog,
        dirtyFields: { industry: true },
      }),
      port
    );

    const primedTag = readIndustryTag(optimisticDto.industry);
    expect(primedTag).toMatchObject({
      subject_group: 'finance',
      subject: '金融與銀行',
    });

    const cachedDto = getUserProfileDtoFromCache(1, 'zh_TW');
    expect(readIndustryTag(cachedDto?.industry)).toMatchObject({
      subject_group: 'finance',
      subject: '金融與銀行',
    });

    resolveFetch(
      makeSyncedDtoFromValues({
        industry: fromAny({
          id: 22,
          kind: 'industry',
          subject_group: 'finance',
          subject: '金融與銀行',
          language: 'zh_TW',
        }),
      })
    );

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('mirrors job_title and company from is_primary work experience in both writeProfile payload and optimistic DTO', async () => {
    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch = resolve;
          })
      ),
      searchMentors: vi.fn<NonNullable<ProfileSavePort['searchMentors']>>(
        async () => [
          makeSyncedMentorCard({
            job_title: 'Staff Engineer',
            company: 'Dell',
          }),
        ]
      ),
    });

    const valuesWithPrimary = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: false,
        },
        {
          id: 1,
          job: 'Staff Engineer',
          company: 'Dell',
          job_period_start: '2018',
          job_period_end: '2020',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
    };

    const optimisticDto = await saveProfile(
      valuesWithPrimary,
      makeContext({ dirtyFields: { work_experiences: [{ job: true }] } }),
      port
    );

    expect(spies.writeProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        job_title: 'Staff Engineer',
        company: 'Dell',
      })
    );
    expect(optimisticDto.job_title).toBe('Staff Engineer');
    expect(optimisticDto.company).toBe('Dell');
    expect(getUserProfileDtoFromCache(1, 'zh_TW')).toMatchObject({
      job_title: 'Staff Engineer',
      company: 'Dell',
    });

    const sentExperiences = spies.writeProfile.mock.calls[0]?.[1]?.experiences;
    expect(sentExperiences?.map((e) => e.category)).toEqual([
      ExperienceType.WORK,
      ExperienceType.EDUCATION,
      ExperienceType.LINK,
    ]);

    resolveFetch(makeSyncedDtoFromValues());

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('clears optimistic job_title, company, about, and personal_statement when explicitly cleared in dirtyFields instead of leaking stale currentDto values', async () => {
    const currentDto = fromPartial<MentorProfileVO>({
      ...mockUserDTO,
      user_id: 1,
      job_title: 'Legacy Title',
      company: 'Legacy Corp',
      about: 'Legacy about',
      personal_statement: 'Legacy statement',
    });

    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch = resolve;
          })
      ),
    });

    const optimisticDto = await saveProfile(
      {
        ...baseValues,
        work_experiences: [],
        about: '',
        statement: '',
      },
      makeContext({
        currentDto,
        dirtyFields: {
          work_experiences: true,
          about: true,
          statement: true,
        },
      }),
      port
    );

    expect(optimisticDto.job_title).toBeNull();
    expect(optimisticDto.company).toBeNull();
    expect(optimisticDto.about).toBeNull();
    expect(optimisticDto.personal_statement).toBeNull();

    resolveFetch(
      makeSyncedDtoFromValues({
        job_title: '',
        company: '',
        about: '',
        personal_statement: '',
      })
    );

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('omits experiences from writeProfile when only name is dirty, and skips writeProfile when dirtyFields is empty (unless isMentorOnboarding)', async () => {
    const { port, spies } = createInMemoryProfileSavePort();

    await saveProfile(
      baseValues,
      makeContext({ dirtyFields: { name: true } }),
      port
    );
    expect(spies.writeProfile).toHaveBeenCalledTimes(1);
    expect(spies.writeProfile.mock.calls[0]?.[1]?.experiences).toBeUndefined();

    spies.writeProfile.mockClear();
    await saveProfile(baseValues, makeContext({ dirtyFields: {} }), port);
    expect(spies.writeProfile).not.toHaveBeenCalled();

    await saveProfile(
      baseValues,
      makeContext({ isMentorOnboarding: true, dirtyFields: {} }),
      port
    );
    expect(spies.writeProfile).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(6);
    });
  });

  // ── mentorPoolReadModel invalidation & haveSkill convergence ───────────────

  it('synchronously clears seeded mentorPoolReadModel unfiltered and filtered queries on save', async () => {
    const filteredQuery: MentorPoolQuery = {
      filter_skills: 'typescript',
      sort_by: 'recent',
    };

    mentorPoolReadModel.set(
      UNFILTERED_MENTOR_POOL_QUERY,
      mentorPoolReadModel.buildInitialUnfilteredState({
        initialMentors: [makeSyncedMentorCard()],
        initialNextCursor: 'cursor:1',
        initialMentorCount: 12,
      })
    );
    mentorPoolReadModel.set(filteredQuery, {
      ...EMPTY_MENTOR_POOL_STATE,
      mentors: [makeSyncedMentorCard()],
      hasMore: false,
      mentorCount: 1,
    });

    expect(mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)).toBeDefined();
    expect(mentorPoolReadModel.get(filteredQuery)).toBeDefined();

    const { port, spies } = createInMemoryProfileSavePort();
    await saveProfile(baseValues, makeContext(), port);

    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(mentorPoolReadModel.get(filteredQuery)).toBeUndefined();

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('polls searchMentors until have_skill catches up, then re-clears mentorPoolReadModel and revalidates path', async () => {
    const editedValues = {
      ...baseValues,
      have_topic: ['career'],
      have_skill: ['react_nextjs', 'system_design'],
    };

    const staleCard = makeSyncedMentorCard({
      have_topic: ['career'],
      have_skill: ['react_nextjs'], // missing system_design on attempt 1
    });
    const syncedCard = makeSyncedMentorCard({
      have_topic: ['career'],
      have_skill: ['system_design', 'react_nextjs'],
    });

    const searchMentors = vi
      .fn<NonNullable<ProfileSavePort['searchMentors']>>()
      .mockImplementationOnce(async () => {
        mentorPoolReadModel.set(
          UNFILTERED_MENTOR_POOL_QUERY,
          mentorPoolReadModel.buildInitialUnfilteredState({
            initialMentors: [staleCard],
            initialNextCursor: null,
            initialMentorCount: 1,
          })
        );
        return [staleCard];
      })
      .mockResolvedValueOnce([syncedCard]);

    const { port, spies } = createInMemoryProfileSavePort({
      searchMentors,
    });

    await saveProfile(editedValues, makeContext(), port);

    await vi.waitFor(() => {
      expect(searchMentors).toHaveBeenCalledTimes(2);
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('skips searchMentors polling and second revalidation for mentee saves when backend confirms non-mentor', async () => {
    const menteeSession: Session = {
      ...mockSession,
      user: { ...mockSession.user!, isMentor: false, onBoarding: true },
    };

    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
        async () =>
          makeSyncedDtoFromValues({
            is_mentor: false,
            onboarding: true,
          })
      ),
    });

    await saveProfile(
      baseValues,
      makeContext({ session: menteeSession, isMentorOnboarding: false }),
      port
    );

    await vi.waitFor(() => {
      expect(spies.fetchProfile).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(spies.searchMentors).not.toHaveBeenCalled();
    expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(1);
  });

  // ── Navigation order, DTO cache fallback & Session reconciliation ──────────

  it('completes revalidateProfilePath and optimistic updateSession before navigate, and navigates to /profile/card on mentor onboarding', async () => {
    const { port, spies } = createInMemoryProfileSavePort();

    await saveProfile(
      baseValues,
      makeContext({ pageUserId: '42', isMentorOnboarding: false }),
      port
    );

    expect(spies.navigate).toHaveBeenCalledWith('/profile/42');
    expect(
      spies.revalidateProfilePath.mock.invocationCallOrder[0]
    ).toBeLessThan(spies.navigate.mock.invocationCallOrder[0]);
    expect(spies.updateSession.mock.invocationCallOrder[0]).toBeLessThan(
      spies.navigate.mock.invocationCallOrder[0]
    );

    const onboardingPort = createInMemoryProfileSavePort();
    await saveProfile(
      baseValues,
      makeContext({ pageUserId: '42', isMentorOnboarding: true }),
      onboardingPort.port
    );
    expect(onboardingPort.spies.navigate).toHaveBeenCalledWith('/profile/card');

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
      expect(onboardingPort.spies.revalidateProfilePath).toHaveBeenCalledTimes(
        2
      );
    });
  });

  it('falls back from stale fast fetch to convergence polling, primes backend truth once synced, and reconciles session when role differs', async () => {
    primeUserProfileDtoCache(
      1,
      'zh_TW',
      fromPartial<MentorProfileVO>({ user_id: 1, name: 'Pre-Edit Cached' })
    );

    const staleBackendDto = makeSyncedDtoFromValues({
      name: 'Old Backend Name',
    });
    const convergedDisagreeingDto = makeSyncedDtoFromValues({
      is_mentor: false,
      onboarding: true,
    });

    const fetchProfile = vi
      .fn<NonNullable<ProfileSavePort['fetchProfile']>>()
      .mockResolvedValueOnce(staleBackendDto) // fast initial check -> stale -> null
      .mockResolvedValueOnce(staleBackendDto) // poll attempt 1 -> stale
      .mockResolvedValueOnce(convergedDisagreeingDto); // poll attempt 2 -> synced!

    const { port, spies } = createInMemoryProfileSavePort({ fetchProfile });

    await saveProfile(baseValues, makeContext(), port);

    await vi.waitFor(() => {
      expect(spies.updateSession).toHaveBeenCalledTimes(2);
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });

    expect(getUserProfileDtoFromCache(1, 'zh_TW')).toBe(
      convergedDisagreeingDto
    );
    expect(spies.updateSession.mock.calls[1]?.[0]).toMatchObject({
      user: {
        isMentor: false,
        onBoarding: true,
      },
    });
  });

  it('tolerates revalidateProfilePath and updateSession failures without blocking navigation, and logs post_sync_revalidate warnings', async () => {
    const revalidateProfilePath = vi
      .fn<ProfileSavePort['revalidateProfilePath']>()
      .mockRejectedValueOnce(new Error('Immediate revalidate failed'))
      .mockRejectedValueOnce(new Error('Post-sync revalidate failed'));

    const updateSession = vi
      .fn<ProfileSavePort['updateSession']>()
      .mockRejectedValueOnce(new Error('Session update failed'));

    const { port, spies } = createInMemoryProfileSavePort({
      revalidateProfilePath,
      updateSession,
    });

    await expect(
      saveProfile(baseValues, makeContext({ pageUserId: '7' }), port)
    ).resolves.toBeDefined();

    expect(spies.navigate).toHaveBeenCalledWith('/profile/7');

    await vi.waitFor(() => {
      expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'profile_update',
          step: 'post_sync_revalidate',
          message: 'Post-sync revalidate failed',
          level: 'warning',
        })
      );
    });
  });

  it('falls back to numeric pageUserId when session is null', async () => {
    const fetchProfile = vi.fn<NonNullable<ProfileSavePort['fetchProfile']>>(
      async (userId) => makeSyncedDtoFromValues({ user_id: userId })
    );
    const searchMentors = vi.fn<NonNullable<ProfileSavePort['searchMentors']>>(
      async () => [makeSyncedMentorCard({ user_id: 99 })]
    );
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile,
      searchMentors,
    });

    await saveProfile(
      baseValues,
      makeContext({ session: null, pageUserId: '99' }),
      port
    );

    await vi.waitFor(() => {
      expect(spies.fetchProfile).toHaveBeenCalledWith(99);
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
    expect(getUserProfileDtoFromCache(99, 'zh_TW')?.user_id).toBe(99);
  });
});
