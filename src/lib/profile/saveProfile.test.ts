import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import type { Session } from 'next-auth';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import { resolveIdentity } from '@/lib/auth/sessionHint';
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
import { profileReadModel } from '@/lib/profile/profileReadModel';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import {
  onboardingDefaultValues,
  type ProfileFormValues,
} from '@/schemas/profileSchema';
import { createAvatarUploadSession } from '@/services/profile/avatarUploadSession';
import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileWritePayload } from '@/services/profile/updateProfile';
import { baseValues, mockSession, mockUserDTO } from '@/test/fixtures/profile';
import type { MentorRequest, MentorType } from '@/types/mentor';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorIndustryVO, MentorProfileVO } from '@/types/user';

import {
  type CommitProfileContext,
  commitProfileMutation,
  LoggedError,
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
    profileReadModel.clear();
    mentorPoolReadModel.clear();
  });

  afterEach(() => {
    clearPendingFavoriteMentor();
    profileReadModel.clear();
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

  it('encodes mentee-onboarding mode from ProfileFormValues, primes cache with catalog industry, revalidates ISR, avoids avatarUpdatedAt misfire on empty avatar, and honors pending favorite redirect', async () => {
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

    const onboardingValues: ProfileFormValues = {
      ...onboardingDefaultValues,
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
    expect(
      profileReadModel.peek({ userId: 1, language: 'zh_TW' })
    ).toBeDefined();

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
      const resolved = await profileReadModel.resolveFetch(
        { userId: 1, language: 'zh_TW' },
        async () => candidate,
        new AbortController().signal
      );
      expect(resolved).toBe(optimisticDto);
    }

    const fullyConvergedBackendDto: MentorProfileVO = {
      ...optimisticDto,
      have_skill: ['nextjs', 'typescript'],
    };
    const convergedSwr = await profileReadModel.resolveFetch(
      { userId: 1, language: 'zh_TW' },
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

  it('uploads avatarFile via ProfileSavePort, writes versioned URL to profile, bumps session avatarUpdatedAt, primes profileReadModel synchronously, and converges against &cb= search-index card', async () => {
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
    expect(
      profileReadModel.peek({ userId: 1, language: 'zh_TW' })?.avatar
    ).toBe(uploadedUrl);

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
          ...onboardingDefaultValues,
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

  it('wires two-phase AvatarUploadSession: retains S3 rollback snapshot when PUT /profile fails (step="profile_write"), commits only on PUT success, and tags step="avatar_upload" on upload failure (#943)', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('S3 presigned failure'))
      .mockResolvedValueOnce('https://cdn.example.com/u/1/avatar?v=200')
      .mockResolvedValueOnce('https://cdn.example.com/u/1/avatar?v=201')
      .mockResolvedValueOnce('https://cdn.example.com/u/1/avatar?v=300');
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValue(new Blob(['prior-s3-bytes'], { type: 'image/png' }));

    const avatarSession = createAvatarUploadSession({
      userId: 1,
      fetchSnapshot,
      upload,
      onUploadFailed: vi.fn(),
    });

    const file1 = new File(['crop1'], 'crop1.png', { type: 'image/png' });
    const { port: failUploadPort, spies: failUploadSpies } =
      createInMemoryProfileSavePort();
    failUploadPort.avatarSession = avatarSession;

    // 1. Step 1 failure surfaces LoggedError with step === 'avatar_upload' and never calls writeProfile
    let caughtUploadErr: unknown;
    try {
      await commitProfileMutation(
        { mode: 'edit', values: { ...baseValues, avatarFile: file1 } },
        makeCommitContext(),
        failUploadPort
      );
    } catch (e) {
      caughtUploadErr = e;
    }
    expect(caughtUploadErr).toBeInstanceOf(LoggedError);
    expect((caughtUploadErr as LoggedError).step).toBe('avatar_upload');
    expect(failUploadSpies.writeProfile).not.toHaveBeenCalled();

    // 2. Stage crop2 -> Step 1 resolve() succeeds, Step 2 writeProfile() rejects with step === 'profile_write'
    const file2 = new File(['crop2'], 'crop2.png', { type: 'image/png' });
    avatarSession.stage(file2, 'https://cdn.example.com/u/1/avatar?v=1');

    const { port: failWritePort } = createInMemoryProfileSavePort({
      writeProfile: vi.fn<WriteProfileFn>(async () => {
        throw new Error('DB timeout');
      }),
    });
    failWritePort.avatarSession = avatarSession;

    let caughtWriteErr: unknown;
    try {
      await commitProfileMutation(
        { mode: 'edit', values: { ...baseValues, avatarFile: file2 } },
        makeCommitContext(),
        failWritePort
      );
    } catch (e) {
      caughtWriteErr = e;
    }
    expect(caughtWriteErr).toBeInstanceOf(LoggedError);
    expect((caughtWriteErr as LoggedError).step).toBe('profile_write');

    // Because markCommitted() was NOT called, rollback() restores prior-s3-bytes!
    await avatarSession.rollback();
    expect(upload).toHaveBeenCalledTimes(3);
    await expect(upload.mock.calls[2]![0].text()).resolves.toBe(
      'prior-s3-bytes'
    );

    // 3. Happy path: stage crop3 -> Step 1 resolve() + Step 2 writeProfile() succeed -> markCommitted() clears snapshot
    const file3 = new File(['crop3'], 'crop3.png', { type: 'image/png' });
    avatarSession.stage(file3, 'https://cdn.example.com/u/1/avatar?v=1');

    const { port: okPort, spies: okSpies } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(async () =>
        makeSyncedDtoFromValues({
          avatar: 'https://cdn.example.com/u/1/avatar?v=300',
        })
      ),
      searchMentors: vi.fn<SearchMentorsPortFn>(async () => [
        makeSyncedMentorCard({
          avatar: 'https://cdn.example.com/u/1/avatar?v=300',
        }),
      ]),
    });
    okPort.avatarSession = avatarSession;

    await commitProfileMutation(
      { mode: 'edit', values: { ...baseValues, avatarFile: file3 } },
      makeCommitContext(),
      okPort
    );
    expect(okSpies.writeProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        avatar: 'https://cdn.example.com/u/1/avatar?v=300',
      })
    );

    // Subsequent rollback after commit is a complete no-op
    await avatarSession.rollback();
    expect(upload).toHaveBeenCalledTimes(4);
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

    const cachedDto = profileReadModel.peek({ userId: 1, language: 'zh_TW' });
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
    expect(
      profileReadModel.peek({ userId: 1, language: 'zh_TW' })
    ).toMatchObject({
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

    const invalidateSpy = vi.spyOn(
      mentorPoolReadModel,
      'invalidateAfterMutation'
    );
    const { port, spies } = createInMemoryProfileSavePort();
    await saveProfile(baseValues, makeContext(), port);

    expect(invalidateSpy).toHaveBeenCalled();
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(mentorPoolReadModel.get(filteredQuery)).toBeUndefined();

    await vi.waitFor(() => {
      expect(spies.revalidateProfilePath).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });
    invalidateSpy.mockRestore();
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
    profileReadModel.prime(
      { userId: 1, language: 'zh_TW' },
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

    expect(profileReadModel.peek({ userId: 1, language: 'zh_TW' })).toBe(
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
    expect(
      profileReadModel.peek({ userId: 99, language: 'zh_TW' })?.user_id
    ).toBe(99);
  });

  it('clears avatar, location, and years_of_experience optimistically and guards against stale SWR DTOs when dirtyFields mark them cleared (#905)', async () => {
    const staleDtoWithOldAvatar = makeSyncedDtoFromValues({
      avatar: 'https://example.com/old-avatar.png',
      location: 'TWN',
      years_of_experience: '3_5',
    });
    const convergedClearedDto = makeSyncedDtoFromValues({
      avatar: null,
      location: null,
      years_of_experience: null,
    });

    const fetchProfile = vi
      .fn<FetchProfileFn>()
      .mockResolvedValueOnce(staleDtoWithOldAvatar)
      .mockResolvedValueOnce(convergedClearedDto);

    const { port, spies } = createInMemoryProfileSavePort({ fetchProfile });

    const result = await commitProfileMutation(
      {
        mode: 'edit',
        values: {
          ...baseValues,
          avatar: '',
          avatarFile: undefined,
          location: '',
          years_of_experience: '',
        },
        dirtyFields: {
          avatar: true,
          location: true,
          years_of_experience: true,
        },
        currentDto: staleDtoWithOldAvatar,
      },
      makeCommitContext({
        session: {
          ...mockSession,
          user: {
            ...mockSession.user!,
            avatar: 'https://example.com/old-avatar.png',
          },
        },
      }),
      port
    );

    expect(result.avatar).toBeNull();
    expect(result.location).toBeNull();
    expect(result.years_of_experience).toBeNull();
    expect(spies.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          avatar: null,
          avatarUpdatedAt: expect.any(Number),
        }),
      })
    );

    await vi.waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledTimes(2);
    });
    expect(
      profileReadModel.peek({ userId: 1, language: 'zh_TW' })?.avatar
    ).toBeNull();
  });

  it('propagates non-default language (en_US) into background fetchProfile and profileReadModel during mentee-onboarding (#905)', async () => {
    const enDto = makeSyncedDtoFromValues({
      name: 'Ada English',
      is_mentor: false,
      onboarding: true,
      language: 'en_US',
    });
    const fetchProfile = vi.fn<FetchProfileFn>().mockResolvedValueOnce(enDto);
    const { port } = createInMemoryProfileSavePort({ fetchProfile });

    await commitProfileMutation(
      {
        mode: 'mentee-onboarding',
        values: {
          ...onboardingDefaultValues,
          name: 'Ada English',
          avatar: '',
          avatarFile: undefined,
          language: 'en_US',
          location: 'Taiwan',
          years_of_experience: '1_3',
          industry: '',
          want_position: ['engineer'],
          want_skill: ['TypeScript'],
          want_topic: ['frontend'],
        },
      },
      makeCommitContext(),
      port
    );

    await vi.waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledWith(1, 'en_US');
    });
    expect(profileReadModel.peek({ userId: 1, language: 'en_US' })?.name).toBe(
      'Ada English'
    );
  });

  it('reconciles jobTitle, company, and personalLinks from backend truth instead of overwriting Session.user with stale form-closed values (#936)', async () => {
    const { experiences: backendExperiences } = encode({
      workExperiences: [
        {
          job: 'Backend Principal Engineer',
          company: 'Backend Corp',
          job_period_start: '2022',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'Core architecture',
          is_primary: true,
        },
      ],
      educations: [],
      personalLinks: [
        {
          platform: 'linkedin',
          url: 'https://linkedin.com/in/backend-truth',
        },
      ],
    });

    const backendTruthDto = makeSyncedDtoFromValues({
      name: 'Edited Name Only',
      job_title: 'Backend Principal Engineer',
      company: 'Backend Corp',
      experiences: toWireExperiences(backendExperiences),
    });

    const fetchProfile = vi
      .fn<FetchProfileFn>()
      .mockResolvedValueOnce(backendTruthDto);
    const searchMentors = vi.fn<SearchMentorsPortFn>(async () => [
      makeSyncedMentorCard({
        name: 'Edited Name Only',
        job_title: '',
        company: '',
      }),
    ]);
    const { port, spies } = createInMemoryProfileSavePort({
      fetchProfile,
      searchMentors,
    });

    const staleSession: Session = {
      ...mockSession,
      user: {
        ...mockSession.user!,
        avatarUpdatedAt: 1700000999000,
        jobTitle: 'Stale Session Title',
        company: 'Stale Session Co',
        personalLinks: [
          { platform: 'github', url: 'https://github.com/stale-session' },
        ],
      },
    };

    await saveProfile(
      {
        ...baseValues,
        name: 'Edited Name Only',
      },
      makeContext({
        session: staleSession,
        dirtyFields: { name: true },
      }),
      port
    );

    // Step 4: optimistic session write keeps prior session jobTitle/company/personalLinks since experiences weren't dirty
    expect(spies.updateSession).toHaveBeenCalledTimes(1);
    expect(spies.updateSession.mock.calls[0]?.[0]).toMatchObject({
      user: {
        id: '1',
        name: 'Edited Name Only',
        avatarUpdatedAt: 1700000999000,
        jobTitle: 'Stale Session Title',
        company: 'Stale Session Co',
        personalLinks: [
          { platform: 'github', url: 'https://github.com/stale-session' },
        ],
      },
    });

    // Step 6: background reconciliation detects divergence on jobTitle/company/personalLinks
    // (even though name, avatar, isMentor, and onBoarding all match!) and writes backend truth!
    await vi.waitFor(() => {
      expect(spies.updateSession).toHaveBeenCalledTimes(2);
    });

    expect(spies.updateSession.mock.calls[1]?.[0]).toMatchObject({
      user: {
        id: '1',
        name: 'Edited Name Only',
        avatar: baseValues.avatar,
        avatarUpdatedAt: 1700000999000,
        isMentor: true,
        onBoarding: true,
        jobTitle: 'Backend Principal Engineer',
        company: 'Backend Corp',
        personalLinks: [
          {
            platform: 'linkedin',
            url: 'https://linkedin.com/in/backend-truth',
          },
        ],
      },
    });
  });

  it('serializes cleared jobTitle and company as empty strings across JSON updateSession wire transport so JWT and resolveIdentity clear stale values (#936)', async () => {
    const existingJwtToken: Record<string, unknown> = {
      id: '1',
      name: 'Test User',
      avatar: baseValues.avatar,
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Stuck JWT Title',
      company: 'Stuck JWT Company',
      personalLinks: [{ platform: 'github', url: 'https://github.com/old' }],
    };

    const updateSession = vi.fn<UpdateSessionFn>(async (rawData) => {
      // Simulate NextAuth client -> server HTTP JSON.stringify round-trip + jwtCallback merge
      const wirePayload = JSON.parse(JSON.stringify(rawData)) as {
        user?: Record<string, unknown>;
      };
      Object.assign(existingJwtToken, wirePayload.user);
      return {
        ...mockSession,
        user: {
          id: String(existingJwtToken.id),
          name: existingJwtToken.name as string,
          avatar: existingJwtToken.avatar as string,
          isMentor: Boolean(existingJwtToken.isMentor),
          onBoarding: Boolean(existingJwtToken.onBoarding),
          jobTitle:
            (existingJwtToken.jobTitle as string | undefined) ?? undefined,
          company:
            (existingJwtToken.company as string | undefined) ?? undefined,
          personalLinks:
            (existingJwtToken.personalLinks as Array<{
              platform: string;
              url: string;
            }>) ?? [],
        },
      };
    });

    const clearedDto = makeSyncedDtoFromValues({
      job_title: null,
      company: null,
      experiences: [],
    });

    const { port } = createInMemoryProfileSavePort({
      updateSession,
      fetchProfile: vi.fn<FetchProfileFn>(async () => clearedDto),
    });

    await saveProfile(
      {
        ...baseValues,
        work_experiences: [],
        links: { ...baseValues.links },
      },
      makeContext({
        session: {
          ...mockSession,
          user: {
            ...mockSession.user!,
            jobTitle: 'Stuck JWT Title',
            company: 'Stuck JWT Company',
            personalLinks: [
              { platform: 'github', url: 'https://github.com/old' },
            ],
          },
        },
        dirtyFields: { work_experiences: true, links: { github: true } },
      }),
      port
    );

    expect(existingJwtToken.jobTitle).toBe('');
    expect(existingJwtToken.company).toBe('');
    expect(existingJwtToken.personalLinks).toEqual([]);

    const postSaveSession = await updateSession.mock.results[0]?.value;
    const resolved = resolveIdentity(postSaveSession, 'authenticated', null);
    expect(resolved.jobTitle).toBeUndefined();
    expect(resolved.company).toBeUndefined();
    expect(resolved.personalLinks).toEqual([]);
  });

  it('preserves currentDto/sessionUser jobTitle, company, and personalLinks without leaking untouched form values or drifting between profileReadModel and updateSession (#936)', async () => {
    const staleFormValues = {
      ...baseValues,
      name: 'Updated Display Name',
      work_experiences: [
        {
          id: 0,
          job: 'Stale Untouched Form Role',
          company: 'Stale Untouched Form Co',
          job_period_start: '2019',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'stale',
          is_primary: true,
        },
      ],
      links: {
        ...baseValues.links,
        github: 'https://github.com/stale-untouched-form',
      },
    };

    // Case 1: currentDto carries newer work & link fields while work_experiences and links are clean
    const { experiences: dtoExperiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/dto-fresh' },
      ],
    });
    const newerCurrentDto = makeSyncedDtoFromValues({
      name: 'Old Name',
      job_title: 'Fresh DTO Role',
      company: 'Fresh DTO Co',
      experiences: toWireExperiences(dtoExperiences),
    });

    let resolveFetch1: (dto: MentorProfileVO | null) => void = () => {};
    const { port: port1, spies: spies1 } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch1 = resolve;
          })
      ),
    });

    await saveProfile(
      staleFormValues,
      makeContext({
        currentDto: newerCurrentDto,
        dirtyFields: { name: true },
      }),
      port1
    );

    expect(spies1.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          name: 'Updated Display Name',
          jobTitle: 'Fresh DTO Role',
          company: 'Fresh DTO Co',
          personalLinks: [
            { platform: 'linkedin', url: 'https://linkedin.com/in/dto-fresh' },
          ],
        }),
      })
    );
    expect(profileReadModel.getOptimisticIdentity(1)).toMatchObject({
      name: 'Updated Display Name',
      jobTitle: 'Fresh DTO Role',
      company: 'Fresh DTO Co',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/dto-fresh' },
      ],
    });

    resolveFetch1({
      ...newerCurrentDto,
      name: 'Updated Display Name',
    });
    await vi.waitFor(() => {
      expect(spies1.fetchProfile).toHaveBeenCalledTimes(1);
    });

    // Case 2: currentDto is null (experiencesPayload === undefined && !currentDto?.experiences),
    // sessionUser carries jobTitle, company, and mixed-case BFF personalLinks — zero 10s window drift!
    profileReadModel.clear();
    let resolveFetch2: (dto: MentorProfileVO | null) => void = () => {};
    const { port: port2, spies: spies2 } = createInMemoryProfileSavePort({
      fetchProfile: vi.fn<FetchProfileFn>(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveFetch2 = resolve;
          })
      ),
    });

    const sessionWithIdentity: Session = {
      ...mockSession,
      user: {
        ...mockSession.user!,
        jobTitle: 'Session Staff Role',
        company: 'Session Corp',
        personalLinks: [
          { platform: 'GitHub', url: 'https://github.com/session-owner' },
        ],
      },
    };

    const optimisticDto2 = await saveProfile(
      staleFormValues,
      makeContext({
        session: sessionWithIdentity,
        currentDto: null,
        dirtyFields: { name: true },
      }),
      port2
    );

    expect(optimisticDto2.job_title).toBe('Session Staff Role');
    expect(optimisticDto2.company).toBe('Session Corp');
    expect(spies2.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          name: 'Updated Display Name',
          jobTitle: 'Session Staff Role',
          company: 'Session Corp',
          personalLinks: [
            { platform: 'github', url: 'https://github.com/session-owner' },
          ],
        }),
      })
    );
    expect(profileReadModel.getOptimisticIdentity(1)).toMatchObject({
      name: 'Updated Display Name',
      jobTitle: 'Session Staff Role',
      company: 'Session Corp',
      personalLinks: [
        { platform: 'github', url: 'https://github.com/session-owner' },
      ],
    });

    resolveFetch2(
      makeSyncedDtoFromValues({
        name: 'Updated Display Name',
        job_title: 'Session Staff Role',
        company: 'Session Corp',
      })
    );
    await vi.waitFor(() => {
      expect(spies2.fetchProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves hidden opposite-role want_position in optimisticDto and convergence during mentor-onboarding (#1336)', async () => {
    const currentMenteeDto = makeSyncedDtoFromValues({
      is_mentor: false,
      onboarding: true,
      want_position: ['frontend_engineer', 'product_manager'],
      want_skill: ['react'],
      want_topic: ['career_planning'],
    });
    const backendAfterUpgrade = makeSyncedDtoFromValues({
      is_mentor: true,
      onboarding: true,
      want_position: ['frontend_engineer', 'product_manager'],
      want_skill: ['react'],
      want_topic: ['career_planning'],
      have_skill: ['system_design'],
      have_topic: ['mock_interview'],
    });
    const fetchProfile = vi
      .fn<FetchProfileFn>()
      .mockResolvedValueOnce(backendAfterUpgrade);
    const { port, spies } = createInMemoryProfileSavePort({ fetchProfile });

    const optimistic = await commitProfileMutation(
      {
        mode: 'mentor-onboarding',
        values: {
          ...baseValues,
          is_mentor: true,
          want_position: [],
          want_skill: [],
          want_topic: [],
          have_skill: ['system_design'],
          have_topic: ['mock_interview'],
        },
        currentDto: currentMenteeDto,
      },
      makeCommitContext(),
      port
    );

    expect(spies.writeProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        want_position: ['frontend_engineer', 'product_manager'],
        want_skill: ['react'],
        want_topic: ['career_planning'],
      })
    );
    expect(optimistic.want_position).toEqual([
      'frontend_engineer',
      'product_manager',
    ]);
    expect(
      profileReadModel.peek({ userId: 1, language: 'zh_TW' })?.want_position
    ).toEqual(['frontend_engineer', 'product_manager']);

    await vi.waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('imports profileReadModel directly in saveProfile.ts with zero legacy userProfileDtoCache or React/Next/hook imports (#936)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'saveProfile.ts'),
      'utf8'
    );

    expect(source).toMatch(/from\s+['"]@\/lib\/profile\/profileReadModel['"]/);
    expect(source).not.toMatch(/userProfileDtoCache/);
    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/from\s+['"]next\//);
    expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
    expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
  });
});
