import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import {
  getUserProfileDtoFromCache,
  primeUserProfileDtoCache,
  resolveUserProfileDtoFetch,
  userProfileDtoReadManager,
} from '@/lib/cache/userProfileDtoCache';
import {
  clearPendingFavoriteMentor,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import {
  EMPTY_MENTOR_POOL_STATE,
  type MentorPoolQuery,
  mentorPoolReadModel,
  UNFILTERED_MENTOR_POOL_QUERY,
} from '@/lib/mentor/mentorPoolReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileWritePayload } from '@/services/profile/updateProfile';
import { baseValues, mockSession, mockUserDTO } from '@/test/fixtures/profile';
import type { MentorRequest, MentorType } from '@/types/mentor';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorIndustryVO, MentorProfileVO } from '@/types/user';

import {
  type CommitProfileContext,
  commitProfileMutation,
  type ProfileSavePort,
  saveProfile,
  type SaveProfileContext,
} from './saveProfile';

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockTrackEvent = vi.mocked(trackEvent);

const FAST_TEST_BUDGET: SaveProfileContext['convergenceBudget'] = {
  fastFetchTimeoutMs: 50,
  profileMaxRetries: 2,
  profileIntervalMs: 0,
  searchIndexMaxRetries: 2,
  searchIndexIntervalMs: 0,
};

type UploadAvatarFn = (
  file: File,
  userId: number | undefined
) => Promise<string | undefined>;
type WriteProfileFn = (
  pageUserId: string,
  payload: MentorProfileWritePayload
) => Promise<void>;
type FetchProfileFn = (userId: number) => Promise<MentorProfileVO | null>;
type SearchMentorsPortFn = (request: MentorRequest) => Promise<MentorType[]>;
type UpdateSessionFn = (data: unknown) => Promise<Session | null>;
type RevalidateProfilePathFn = (pageUserId: string) => Promise<void>;
type NavigateFn = (path: string) => void;

interface ProfileSaveSpies {
  uploadAvatar: ReturnType<typeof vi.fn<UploadAvatarFn>>;
  writeProfile: ReturnType<typeof vi.fn<WriteProfileFn>>;
  fetchProfile: ReturnType<typeof vi.fn<FetchProfileFn>>;
  searchMentors: ReturnType<typeof vi.fn<SearchMentorsPortFn>>;
  updateSession: ReturnType<typeof vi.fn<UpdateSessionFn>>;
  revalidateProfilePath: ReturnType<typeof vi.fn<RevalidateProfilePathFn>>;
  navigate: ReturnType<typeof vi.fn<NavigateFn>>;
}

function makeSyncedDtoFromValues(
  overrides: Partial<MentorProfileVO> = {}
): MentorProfileVO {
  const defaultIndustry: MentorIndustryVO | null = baseValues.industry
    ? {
        id: 1,
        kind: 'industry',
        subject_group: baseValues.industry,
        subject: '軟體與科技',
        language: 'zh_TW',
      }
    : null;

  return {
    ...mockUserDTO,
    user_id: overrides.user_id ?? 1,
    name: overrides.name !== undefined ? overrides.name : baseValues.name,
    avatar:
      overrides.avatar !== undefined
        ? overrides.avatar
        : (baseValues.avatar ?? mockUserDTO.avatar),
    job_title: overrides.job_title !== undefined ? overrides.job_title : null,
    company: overrides.company !== undefined ? overrides.company : null,
    location:
      overrides.location !== undefined
        ? overrides.location
        : (baseValues.location ?? null),
    personal_statement:
      overrides.personal_statement !== undefined
        ? overrides.personal_statement
        : (baseValues.statement ?? null),
    about:
      overrides.about !== undefined
        ? overrides.about
        : (baseValues.about ?? null),
    years_of_experience:
      overrides.years_of_experience !== undefined
        ? overrides.years_of_experience
        : (baseValues.years_of_experience ?? null),
    industry:
      overrides.industry !== undefined ? overrides.industry : defaultIndustry,
    onboarding:
      overrides.onboarding !== undefined
        ? (overrides.onboarding ?? null)
        : (mockUserDTO.onboarding ?? null),
    is_mentor:
      overrides.is_mentor !== undefined
        ? (overrides.is_mentor ?? null)
        : (mockUserDTO.is_mentor ?? null),
    want_position:
      overrides.want_position !== undefined
        ? overrides.want_position
        : baseValues.want_position,
    want_skill:
      overrides.want_skill !== undefined
        ? overrides.want_skill
        : baseValues.want_skill,
    want_topic:
      overrides.want_topic !== undefined
        ? overrides.want_topic
        : baseValues.want_topic,
    have_skill:
      overrides.have_skill !== undefined
        ? overrides.have_skill
        : baseValues.have_skill,
    have_topic:
      overrides.have_topic !== undefined
        ? overrides.have_topic
        : baseValues.have_topic,
    experiences:
      overrides.experiences !== undefined ? overrides.experiences : [],
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
    vi.fn<UploadAvatarFn>(
      async () =>
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000'
    );
  const writeProfile =
    overrides.writeProfile ?? vi.fn<WriteProfileFn>(async () => undefined);
  const fetchProfile =
    overrides.fetchProfile ??
    vi.fn<FetchProfileFn>(async () => makeSyncedDtoFromValues());
  const searchMentors =
    overrides.searchMentors ??
    vi.fn<SearchMentorsPortFn>(async () => [makeSyncedMentorCard()]);
  const updateSession =
    overrides.updateSession ?? vi.fn<UpdateSessionFn>(async () => mockSession);
  const revalidateProfilePath =
    overrides.revalidateProfilePath ??
    vi.fn<RevalidateProfilePathFn>(async () => undefined);
  const navigate = overrides.navigate ?? vi.fn<NavigateFn>();

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

function makeCommitContext(
  overrides: Partial<CommitProfileContext> = {}
): CommitProfileContext {
  return {
    pageUserId: '1',
    session: mockSession,
    convergenceBudget: FAST_TEST_BUDGET,
    ...overrides,
  };
}

describe('commitProfileMutation & saveProfile (Deep Module with ProfileSavePort)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingFavoriteMentor();
    userProfileDtoReadManager.clear();
    mentorPoolReadModel.clear();
  });

  afterEach(() => {
    clearPendingFavoriteMentor();
    userProfileDtoReadManager.clear();
    mentorPoolReadModel.clear();
  });

  // ── Canonical Wire Payloads Across All 3 Mutation Modes ────────────────────

  it('encodes edit mode payload with normalized string about, single-line personal_statement, and zero UI-only RHF keys', async () => {
    const currentDto = makeSyncedDtoFromValues({
      personal_statement: 'Fallback personal statement',
    });
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          personal_statement: 'Fallback personal statement',
          about: '',
        })
      ),
    });

    await commitProfileMutation(
      {
        mode: 'edit',
        values: {
          ...baseValues,
          about: undefined,
          statement: undefined,
          links: {
            ...baseValues.links,
            github: 'https://github.com/octocat',
          },
        },
        currentDto,
      },
      makeCommitContext(),
      port
    );

    expect(spies.writeProfile).toHaveBeenCalledTimes(1);
    const [writtenPageUserId, writtenPayload] =
      spies.writeProfile.mock.calls[0]!;
    expect(writtenPageUserId).toBe('1');
    expect(typeof writtenPayload.about).toBe('string');
    expect(writtenPayload.about).toBe('');
    expect(writtenPayload.personal_statement).toBe(
      'Fallback personal statement'
    );
    expect(writtenPayload).not.toHaveProperty('work_experiences');
    expect(writtenPayload).not.toHaveProperty('educations');
    expect(writtenPayload).not.toHaveProperty('links');
    expect(writtenPayload).not.toHaveProperty('statement');
    expect(writtenPayload).not.toHaveProperty('avatarFile');

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('encodes mentor-onboarding mode with is_mentor: true, onboarding: true, experiences batch, ISR revalidation, and /profile/card navigation', async () => {
    const { experiences } = encode({
      workExperiences: [
        {
          job: 'Staff Frontend Engineer',
          company: 'XChange',
          job_period_start: '2021',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'Design system & architecture',
          is_primary: true,
        },
      ],
      educations: [
        {
          school: '國立臺灣大學',
          subject: '資訊工程學系',
          education_period_start: '2016',
          education_period_end: '2020',
        },
      ],
      personalLinks: [],
    });

    const menteeSession: Session = {
      ...mockSession,
      user: { ...mockSession.user!, isMentor: false, onBoarding: true },
    };

    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          is_mentor: true,
          onboarding: true,
          about: 'Mentor bio',
          job_title: 'Staff Frontend Engineer',
          company: 'XChange',
          industry: {
            id: 5,
            kind: 'industry',
            subject_group: 'tech',
            subject: '軟體與科技',
          },
          have_topic: ['career'],
          have_skill: ['typescript'],
          experiences: toWireExperiences(experiences),
        })
      ),
      searchMentors: vi.fn<SearchMentorsPortFn>(async () => [
        makeSyncedMentorCard({
          about: 'Mentor bio',
          job_title: 'Staff Frontend Engineer',
          company: 'XChange',
          have_topic: ['career'],
          have_skill: ['typescript'],
        }),
      ]),
    });

    const optimisticDto = await commitProfileMutation(
      {
        mode: 'mentor-onboarding',
        values: {
          ...baseValues,
          is_mentor: false,
          about: 'Mentor bio',
          industry: 'tech',
          have_topic: ['career'],
          have_skill: ['typescript'],
          work_experiences: [
            {
              id: 0,
              job: 'Staff Frontend Engineer',
              company: 'XChange',
              job_period_start: '2021',
              job_period_end: 'now',
              industry: 'tech',
              job_location: 'TWN',
              description: 'Design system & architecture',
              is_primary: true,
            },
          ],
          educations: [
            {
              id: 0,
              school: '國立臺灣大學',
              subject: '資訊工程學系',
              education_period_start: '2016',
              education_period_end: '2020',
            },
          ],
        },
        dirtyFields: {},
      },
      makeCommitContext({
        session: menteeSession,
        industryCatalog: [{ subject_group: 'tech', subject: '軟體與科技' }],
      }),
      port
    );

    const writtenPayload = spies.writeProfile.mock.calls[0]?.[1];
    expect(writtenPayload).toMatchObject({
      is_mentor: true,
      onboarding: true,
      about: 'Mentor bio',
      job_title: 'Staff Frontend Engineer',
      company: 'XChange',
      have_topic: ['career'],
      have_skill: ['typescript'],
    });
    expect(writtenPayload).not.toHaveProperty('work_experiences');
    expect(writtenPayload).not.toHaveProperty('educations');
    expect(writtenPayload).not.toHaveProperty('links');
    expect(writtenPayload).not.toHaveProperty('statement');

    expect(optimisticDto.is_mentor).toBe(true);
    expect(optimisticDto.onboarding).toBe(true);
    expect(spies.navigate).toHaveBeenCalledWith('/profile/card');

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('encodes mentee-onboarding mode from OnboardingFormValues, primes cache with catalog industry, revalidates ISR, avoids avatarUpdatedAt misfire on empty avatar, and honors pending favorite redirect', async () => {
    savePendingFavoriteMentor(88);

    const freshMenteeSession: Session = {
      ...mockSession,
      user: {
        id: '1',
        name: 'New Mentee',
        email: 'mentee@example.com',
        isMentor: false,
        onBoarding: false,
        avatar: undefined,
        avatarUpdatedAt: 1700000000000,
      },
    };

    const onboardingValues: OnboardingFormValues = {
      name: 'Mentee Lin',
      avatar: '',
      avatarFile: undefined,
      language: 'zh_TW',
      location: 'TWN',
      years_of_experience: '1_3',
      industry: 'finance',
      want_position: ['product_manager'],
      want_skill: ['product_strategy'],
      want_topic: ['career'],
    };

    const industryCatalog: IndustryOption[] = [
      { subject_group: 'finance', subject: '金融與投資' },
    ];

    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          name: 'Mentee Lin',
          avatar: null,
          location: 'TWN',
          years_of_experience: '1_3',
          industry: {
            id: 8,
            kind: 'industry',
            subject_group: 'finance',
            subject: '金融與投資',
          },
          is_mentor: false,
          onboarding: true,
          about: '',
          personal_statement: '',
          want_position: ['product_manager'],
          want_skill: ['product_strategy'],
          want_topic: ['career'],
          have_skill: [],
          have_topic: [],
        })
      ),
    });

    const optimisticDto = await commitProfileMutation(
      {
        mode: 'mentee-onboarding',
        values: onboardingValues,
      },
      makeCommitContext({
        pageUserId: undefined,
        session: freshMenteeSession,
        industryCatalog,
      }),
      port
    );

    expect(spies.writeProfile).toHaveBeenCalledWith('1', {
      name: 'Mentee Lin',
      avatar: '',
      location: 'TWN',
      years_of_experience: '1_3',
      industry: 'finance',
      language: 'zh_TW',
      is_mentor: false,
      onboarding: true,
      about: '',
      personal_statement: '',
      want_position: ['product_manager'],
      want_skill: ['product_strategy'],
      want_topic: ['career'],
    });

    expect(optimisticDto.is_mentor).toBe(false);
    expect(optimisticDto.onboarding).toBe(true);
    expect(readIndustryTag(optimisticDto.industry)).toMatchObject({
      subject_group: 'finance',
      subject: '金融與投資',
    });
    expect(getUserProfileDtoFromCache(1, 'zh_TW')).toBeDefined();

    // Empty avatar ("") vs undefined session.user.avatar must NOT bump avatarUpdatedAt
    expect(spies.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          name: 'Mentee Lin',
          avatar: null,
          isMentor: false,
          onBoarding: true,
          avatarUpdatedAt: 1700000000000,
        }),
      })
    );

    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_completed',
      feature: 'onboarding',
    });
    expect(spies.revalidateProfilePath).toHaveBeenCalledWith('1');
    expect(spies.navigate).toHaveBeenCalledWith('/profile/88');

    await vi.waitFor(() => {
      expect(spies.fetchProfile).toHaveBeenCalledWith(1);
    });
    expect(spies.searchMentors).not.toHaveBeenCalled();
  });

  it('protects primed optimistic DTO from stale SWR reads across every editable field until backend converges', async () => {
    let resolveBackendFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveBackendFetch = resolve;
          })
      ),
    });

    const optimisticDto = await commitProfileMutation(
      {
        mode: 'edit',
        values: {
          ...baseValues,
          about: 'Fresh mentor bio',
          statement: 'Fresh mentor statement',
          location: 'JPN',
          years_of_experience: '5_10',
          industry: 'tech',
          have_skill: ['typescript', 'nextjs'],
          have_topic: ['architecture'],
          want_position: ['engineering_manager'],
          want_skill: ['coaching'],
          want_topic: ['leadership'],
        },
      },
      makeCommitContext({
        industryCatalog: [{ subject_group: 'tech', subject: '軟體與科技' }],
      }),
      port
    );

    const staleBackendVariants: Array<Partial<MentorProfileVO>> = [
      { about: 'Stale bio' },
      { personal_statement: 'Stale statement' },
      { location: 'TWN' },
      { years_of_experience: '1_3' },
      {
        industry: {
          id: 99,
          kind: 'industry',
          subject_group: 'finance',
          subject: '金融業',
        },
      },
      { have_skill: ['typescript'] },
      { have_topic: [] },
      { want_position: ['engineer'] },
      { want_skill: ['TypeScript'] },
      { want_topic: ['frontend'] },
    ];

    for (const stalePatch of staleBackendVariants) {
      const candidate: MentorProfileVO = {
        ...optimisticDto,
        ...stalePatch,
      };
      const resolved = await resolveUserProfileDtoFetch(
        '1-zh_TW',
        async () => candidate,
        new AbortController().signal
      );
      expect(resolved).toBe(optimisticDto);
    }

    const fullyConvergedBackendDto: MentorProfileVO = {
      ...optimisticDto,
      have_skill: ['nextjs', 'typescript'],
    };
    const convergedSwr = await resolveUserProfileDtoFetch(
      '1-zh_TW',
      async () => fullyConvergedBackendDto,
      new AbortController().signal
    );
    expect(convergedSwr).toBe(fullyConvergedBackendDto);

    resolveBackendFetch(fullyConvergedBackendDto);
    await vi.waitFor(() => {
      expect(spies.fetchProfile).toHaveBeenCalled();
    });
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

  it('uploads avatarFile via ProfileSavePort, writes versioned URL to profile, bumps session avatarUpdatedAt, primes userProfileDtoCache synchronously, and converges against &cb= search-index card', async () => {
    const uploadedUrl =
      'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000';
    const { port, spies } = createInMemoryProfileSavePort({
      uploadAvatar: vi.fn<UploadAvatarFn>(async () => uploadedUrl),
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          avatar: uploadedUrl,
        })
      ),
      searchMentors: vi.fn<SearchMentorsPortFn>(async () => [
        makeSyncedMentorCard({
          avatar: `${uploadedUrl}&cb=2026-11-14T00%3A00%3A00Z`,
        }),
      ]),
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
    expect(spies.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          avatar: uploadedUrl,
          avatarUpdatedAt: expect.any(Number),
        }),
      })
    );
    expect(result.avatar).toBe(uploadedUrl);
    expect(getUserProfileDtoFromCache(1, 'zh_TW')?.avatar).toBe(uploadedUrl);

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('bumps avatarUpdatedAt when a pre-uploaded versioned avatar URL differs from session avatar even after avatarFile was consumed', async () => {
    const preUploadedUrl =
      'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754111111111';
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          name: 'Mentee Preuploaded',
          avatar: preUploadedUrl,
          is_mentor: false,
          onboarding: true,
        })
      ),
    });

    await commitProfileMutation(
      {
        mode: 'mentee-onboarding',
        values: {
          name: 'Mentee Preuploaded',
          avatar: preUploadedUrl,
          avatarFile: undefined,
          language: 'zh_TW',
          location: 'Taiwan',
          years_of_experience: '1_3',
          industry: '',
          want_position: ['engineer'],
          want_skill: ['TypeScript'],
          want_topic: ['frontend'],
        },
      },
      makeCommitContext({
        session: {
          ...mockSession,
          user: {
            ...mockSession.user!,
            isMentor: false,
            avatar: 'https://example.com/old-avatar.jpg',
            avatarUpdatedAt: undefined,
          },
        },
      }),
      port
    );

    expect(spies.uploadAvatar).not.toHaveBeenCalled();
    expect(spies.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          avatar: preUploadedUrl,
          avatarUpdatedAt: expect.any(Number),
        }),
      })
    );
    expect(spies.navigate).toHaveBeenCalledWith('/profile/card');
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
      uploadAvatar: vi.fn<UploadAvatarFn>(async () => {
        throw new Error('Upload failed');
      }),
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
      writeProfile: vi.fn<WriteProfileFn>(async () => {
        throw new Error('Profile update failed');
      }),
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
    const currentDto = makeSyncedDtoFromValues({
      user_id: 1,
      industry: {
        id: 10,
        kind: 'industry',
        subject_group: 'tech',
        subject: '軟體與科技',
        language: 'zh_TW',
      },
    });

    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
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
        industry: {
          id: 22,
          kind: 'industry',
          subject_group: 'finance',
          subject: '金融與銀行',
          language: 'zh_TW',
        },
      })
    );

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('mirrors job_title and company from is_primary work experience in both writeProfile payload and optimistic DTO', async () => {
    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch = resolve;
          })
      ),
      searchMentors: vi.fn<SearchMentorsPortFn>(async () => [
        makeSyncedMentorCard({
          job_title: 'Staff Engineer',
          company: 'Dell',
        }),
      ]),
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

    resolveFetch(
      makeSyncedDtoFromValues({
        job_title: 'Staff Engineer',
        company: 'Dell',
        experiences: toWireExperiences(sentExperiences),
      })
    );

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
  });

  it('clears optimistic job_title, company, about, and personal_statement when explicitly cleared in dirtyFields instead of leaking stale currentDto values', async () => {
    const currentDto = makeSyncedDtoFromValues({
      user_id: 1,
      job_title: 'Legacy Title',
      company: 'Legacy Corp',
      about: 'Legacy about',
      personal_statement: 'Legacy statement',
    });

    let resolveFetch: (dto: MentorProfileVO | null) => void = () => {};
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
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
      have_skill: ['react_nextjs'],
    });
    const syncedCard = makeSyncedMentorCard({
      have_topic: ['career'],
      have_skill: ['system_design', 'react_nextjs'],
    });

    const searchMentors = vi
      .fn<SearchMentorsPortFn>()
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
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          have_topic: ['career'],
          have_skill: ['react_nextjs', 'system_design'],
        })
      ),
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
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
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
      .fn<FetchProfileFn>()
      .mockResolvedValueOnce(staleBackendDto)
      .mockResolvedValueOnce(staleBackendDto)
      .mockResolvedValueOnce(convergedDisagreeingDto);

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
      .fn<RevalidateProfilePathFn>()
      .mockRejectedValueOnce(new Error('Immediate revalidate failed'))
      .mockRejectedValueOnce(new Error('Post-sync revalidate failed'));

    const updateSession = vi
      .fn<UpdateSessionFn>()
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
    const fetchProfile = vi.fn<FetchProfileFn>(async (userId) =>
      makeSyncedDtoFromValues({ user_id: userId })
    );
    const searchMentors = vi.fn<SearchMentorsPortFn>(async () => [
      makeSyncedMentorCard({ user_id: 99 }),
    ]);
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
