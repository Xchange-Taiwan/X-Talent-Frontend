import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureFlowFailure } from '@/lib/monitoring';
import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import { fetchUserById } from '@/services/profile/user';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';
import type { MentorIndustryVO, MentorProfileVO } from '@/types/user';

import {
  hasProfileDtoConverged,
  type MentorCardFields,
  ProfileRecordAdapter,
  runConvergence,
  SearchIndexDeleteAdapter,
  SearchIndexSyncAdapter,
} from './convergence';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

const mockFetchUserById = vi.mocked(fetchUserById);
const mockFetchMentors = vi.mocked(fetchMentors);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const makeMentor = (
  user_id: number,
  overrides: Partial<MentorType> = {}
): MentorType =>
  fromPartial({
    user_id,
    name: `Mentor ${user_id}`,
    job_title: '',
    company: '',
    about: '',
    years_of_experience: '',
    have_topic: [],
    have_skill: [],
    avatar: '',
    ...overrides,
  });

const makeCardFields = (
  overrides: Partial<MentorCardFields> = {}
): MentorCardFields => ({
  name: 'Jane Doe',
  jobTitle: 'Developer',
  company: 'Acme',
  about: 'about-me',
  yearsOfExperience: '5_10',
  haveTopic: ['tech'],
  haveSkill: ['typescript'],
  avatar: 'avatar-url',
  ...overrides,
});

const techIndustry: MentorIndustryVO = {
  id: 1,
  kind: 'industry',
  subject_group: 'tech',
  subject: '軟體與科技',
  language: 'zh_TW',
};

const makeSyncedDto = (
  overrides: Partial<MentorProfileVO> = {}
): MentorProfileVO => {
  const { experiences } = encode({
    workExperiences: [
      {
        job: 'Senior Engineer',
        company: 'Acme',
        job_period_start: '2021',
        job_period_end: 'now',
        industry: 'tech',
        job_location: 'TWN',
        description: 'Platform engineering',
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
    personalLinks: [
      {
        platform: 'github',
        url: 'https://github.com/sync-test',
      },
    ],
  });

  return {
    user_id: overrides.user_id ?? 1,
    name: overrides.name !== undefined ? overrides.name : 'Sync Test',
    avatar:
      overrides.avatar !== undefined
        ? overrides.avatar
        : 'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000',
    job_title:
      overrides.job_title !== undefined
        ? overrides.job_title
        : 'Senior Engineer',
    company: overrides.company !== undefined ? overrides.company : 'Acme',
    location: overrides.location !== undefined ? overrides.location : 'Taiwan',
    about: overrides.about !== undefined ? overrides.about : 'about-me',
    personal_statement:
      overrides.personal_statement !== undefined
        ? overrides.personal_statement
        : 'statement',
    years_of_experience:
      overrides.years_of_experience !== undefined
        ? overrides.years_of_experience
        : '1_3',
    industry:
      overrides.industry !== undefined ? overrides.industry : techIndustry,
    is_mentor:
      overrides.is_mentor !== undefined ? (overrides.is_mentor ?? null) : true,
    onboarding:
      overrides.onboarding !== undefined
        ? (overrides.onboarding ?? null)
        : true,
    language: overrides.language !== undefined ? overrides.language : 'zh_TW',
    seniority_level:
      overrides.seniority_level !== undefined
        ? overrides.seniority_level
        : null,
    experiences:
      overrides.experiences !== undefined
        ? overrides.experiences
        : toWireExperiences(experiences),
    have_skill:
      overrides.have_skill !== undefined
        ? overrides.have_skill
        : ['typescript', 'react_nextjs'],
    have_topic:
      overrides.have_topic !== undefined
        ? overrides.have_topic
        : ['career', 'frontend'],
    want_position:
      overrides.want_position !== undefined
        ? overrides.want_position
        : ['staff_engineer'],
    want_skill:
      overrides.want_skill !== undefined
        ? overrides.want_skill
        : ['system_design'],
    want_topic:
      overrides.want_topic !== undefined
        ? overrides.want_topic
        : ['leadership'],
  };
};

describe('hasProfileDtoConverged', () => {
  it('returns true when all scalar, role, industry, avatar, experience, have_*, and want_* fields match (order-insensitive tags and &cb= cache-buster)', () => {
    const expected = makeSyncedDto();
    const incoming = makeSyncedDto({
      avatar:
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000&cb=2026-11-16T00%3A00%3A00Z',
      have_skill: ['react_nextjs', 'typescript'],
      have_topic: ['frontend', 'career'],
      want_position: ['staff_engineer'],
      want_skill: ['system_design'],
      want_topic: ['leadership'],
    });

    expect(hasProfileDtoConverged(expected, incoming)).toBe(true);
  });

  it('detects stale mismatch on every individual profile field', () => {
    const expected = makeSyncedDto();

    const financeIndustry: MentorIndustryVO = {
      id: 2,
      kind: 'industry',
      subject_group: 'finance',
      subject: '金融業',
      language: 'zh_TW',
    };

    const { experiences: staleExperiences } = encode({
      workExperiences: [
        {
          job: 'Junior Engineer',
          company: 'OldCorp',
          job_period_start: '2019',
          job_period_end: '2021',
          industry: 'tech',
          job_location: 'TWN',
          description: 'Legacy work',
          is_primary: true,
        },
      ],
      educations: [],
      personalLinks: [],
    });

    const cases: Array<[string, Partial<MentorProfileVO>]> = [
      ['name', { name: 'Stale Name' }],
      ['is_mentor', { is_mentor: false }],
      ['onboarding', { onboarding: false }],
      ['job_title', { job_title: 'Junior Engineer' }],
      ['company', { company: 'OldCorp' }],
      ['about', { about: 'stale-about' }],
      ['personal_statement', { personal_statement: 'stale-statement' }],
      ['location', { location: 'USA' }],
      ['years_of_experience', { years_of_experience: '0_1' }],
      ['industry', { industry: financeIndustry }],
      ['industry cleared to null', { industry: null }],
      [
        'avatar version mismatch',
        {
          avatar:
            'https://s3.amazonaws.com/bucket/files/1/avatar?v=1753999999999&cb=now',
        },
      ],
      [
        'experiences content mismatch',
        { experiences: toWireExperiences(staleExperiences) },
      ],
      ['experiences empty', { experiences: [] }],
      ['have_skill', { have_skill: ['typescript'] }],
      ['have_topic', { have_topic: ['career'] }],
      ['want_position', { want_position: ['product_manager'] }],
      ['want_skill', { want_skill: ['golang'] }],
      ['want_topic', { want_topic: ['interview'] }],
    ];

    for (const [label, stalePatch] of cases) {
      const staleIncoming = makeSyncedDto(stalePatch);
      expect(
        hasProfileDtoConverged(expected, staleIncoming),
        `Expected ${label} mismatch to return false`
      ).toBe(false);
    }
  });

  it('treats empty string and null equivalently for cleared scalar fields and empty vs null tag/experience collections', () => {
    const clearedExpected = makeSyncedDto({
      job_title: null,
      company: null,
      about: null,
      personal_statement: null,
      industry: null,
      experiences: [],
      have_skill: [],
      have_topic: [],
      want_position: [],
      want_skill: [],
      want_topic: [],
    });

    const backendEmptyIncoming = makeSyncedDto({
      job_title: '',
      company: '',
      about: '',
      personal_statement: '',
      industry: null,
      experiences: null,
      have_skill: null,
      have_topic: null,
      want_position: null,
      want_skill: null,
      want_topic: null,
    });

    expect(hasProfileDtoConverged(clearedExpected, backendEmptyIncoming)).toBe(
      true
    );
  });

  it('distinguishes undefined vs null sentinels on avatar, is_mentor, and onboarding in isolation (#943)', () => {
    const incomingWithAvatar = makeSyncedDto({
      avatar: 'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000',
      is_mentor: true,
      onboarding: true,
    });

    // avatar === null explicitly requires backend avatar to be empty/null/whitespace
    expect(hasProfileDtoConverged({ avatar: null }, incomingWithAvatar)).toBe(
      false
    );
    expect(
      hasProfileDtoConverged({ avatar: null }, makeSyncedDto({ avatar: null }))
    ).toBe(true);
    expect(
      hasProfileDtoConverged({ avatar: null }, makeSyncedDto({ avatar: '' }))
    ).toBe(true);
    expect(
      hasProfileDtoConverged({ avatar: null }, makeSyncedDto({ avatar: '   ' }))
    ).toBe(true);

    // avatar === undefined imposes zero constraint even when incoming has a non-empty URL
    expect(
      hasProfileDtoConverged({ avatar: undefined }, incomingWithAvatar)
    ).toBe(true);

    // is_mentor sentinel matrix: undefined (unconstrained) vs true / false / null
    expect(
      hasProfileDtoConverged(
        { is_mentor: undefined },
        makeSyncedDto({ is_mentor: true })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: undefined },
        makeSyncedDto({ is_mentor: false })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: false },
        makeSyncedDto({ is_mentor: false })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: false },
        makeSyncedDto({ is_mentor: null })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: false },
        makeSyncedDto({ is_mentor: true })
      )
    ).toBe(false);
    expect(
      hasProfileDtoConverged(
        { is_mentor: null },
        makeSyncedDto({ is_mentor: null })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: null },
        makeSyncedDto({ is_mentor: false })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { is_mentor: null },
        makeSyncedDto({ is_mentor: true })
      )
    ).toBe(false);

    // onboarding sentinel matrix: undefined (unconstrained) vs true / false / null
    expect(
      hasProfileDtoConverged(
        { onboarding: undefined },
        makeSyncedDto({ onboarding: false })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { onboarding: true },
        makeSyncedDto({ onboarding: true })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { onboarding: true },
        makeSyncedDto({ onboarding: false })
      )
    ).toBe(false);
    expect(
      hasProfileDtoConverged(
        { onboarding: false },
        makeSyncedDto({ onboarding: null })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { onboarding: null },
        makeSyncedDto({ onboarding: false })
      )
    ).toBe(true);
    expect(
      hasProfileDtoConverged(
        { onboarding: null },
        makeSyncedDto({ onboarding: true })
      )
    ).toBe(false);
  });
});

describe('runConvergence with Mock Adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately on the first attempt if the adapter is caught up', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('data'),
      isCaughtUp: vi.fn().mockReturnValue(true),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'mock exhaust message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(true);
    expect(latest).toBe('data');
    expect(adapter.fetch).toHaveBeenCalledTimes(1);
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('retries and eventually succeeds when adapter is caught up on subsequent attempts', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('data'),
      isCaughtUp: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'mock exhaust message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(true);
    expect(latest).toBe('data');
    expect(adapter.fetch).toHaveBeenCalledTimes(2);
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('fails and reports exhaustion once retry budget is fully exhausted', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('stale_data'),
      isCaughtUp: vi.fn().mockReturnValue(false),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'exhausted budget message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    await vi.advanceTimersByTimeAsync(1000 * 3);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(false);
    expect(latest).toBe('stale_data');
    expect(adapter.fetch).toHaveBeenCalledTimes(3);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'exhausted budget message',
      })
    );
  });
});

describe('ProfileRecordAdapter', () => {
  beforeEach(() => {
    mockFetchUserById.mockReset();
  });

  it('fetches latest profile by userId using canonical expectedDto constructor', async () => {
    const dto = makeSyncedDto();
    mockFetchUserById.mockResolvedValueOnce(dto);

    const adapter = new ProfileRecordAdapter(1, dto);
    const result = await adapter.fetch();

    expect(result).toBe(dto);
    expect(mockFetchUserById).toHaveBeenCalledWith(1, 'zh_TW', undefined, true);
    expect(adapter.isCaughtUp(dto)).toBe(true);
    expect(
      adapter.isCaughtUp(makeSyncedDto({ want_topic: ['stale_topic'] }))
    ).toBe(false);
  });

  it('returns null on fetch user error', async () => {
    mockFetchUserById.mockRejectedValueOnce(new Error('network error'));

    const adapter = new ProfileRecordAdapter(1, makeSyncedDto());
    const result = await adapter.fetch();

    expect(result).toBeNull();
  });

  it('treats undefined role/experience/avatar fields as unconstrained while treating null as explicitly empty/false (#943)', () => {
    const incoming = makeSyncedDto({
      is_mentor: true,
      onboarding: true,
      avatar: 'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000',
    });

    expect(
      hasProfileDtoConverged(
        {
          name: 'Sync Test',
          is_mentor: undefined,
          onboarding: undefined,
          avatar: undefined,
          job_title: undefined,
          company: undefined,
          experiences: undefined,
        },
        incoming
      )
    ).toBe(true);

    expect(
      hasProfileDtoConverged({ name: 'Sync Test', is_mentor: null }, incoming)
    ).toBe(false);
    expect(
      hasProfileDtoConverged({ name: 'Sync Test', onboarding: null }, incoming)
    ).toBe(false);
    expect(
      hasProfileDtoConverged({ name: 'Sync Test', avatar: null }, incoming)
    ).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const adapter = new ProfileRecordAdapter(1, makeSyncedDto());
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
    });
  });
});

describe('SearchIndexSyncAdapter', () => {
  beforeEach(() => {
    mockFetchMentors.mockReset();
  });

  it('fetches mentors from index scoped to name', async () => {
    const fields = makeCardFields();
    mockFetchMentors.mockResolvedValueOnce({ mentors: [], nextCursor: null });

    const adapter = new SearchIndexSyncAdapter(1, fields);
    const result = await adapter.fetch();

    expect(result).toEqual([]);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane Doe',
      limit: 20,
    });
  });

  it('returns null on fetch mentors error', async () => {
    const fields = makeCardFields();
    mockFetchMentors.mockRejectedValueOnce(new Error('search down'));

    const adapter = new SearchIndexSyncAdapter(1, fields);
    const result = await adapter.fetch();

    expect(result).toBeNull();
  });

  it('is caught up when mentor with userId matches all fields including haveSkill and ?v=+&cb= avatar', () => {
    const fields = makeCardFields({
      haveTopic: ['tech', 'career'],
      haveSkill: ['react_nextjs', 'typescript'],
      avatar: 'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000',
    });
    const adapter = new SearchIndexSyncAdapter(1, fields);

    const matchedMentor = makeMentor(1, {
      name: 'Jane Doe',
      job_title: 'Developer',
      company: 'Acme',
      about: 'about-me',
      years_of_experience: '5_10',
      have_topic: ['career', 'tech'],
      have_skill: ['typescript', 'react_nextjs'],
      avatar:
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000&cb=2026-11-14T00%3A00%3A00Z',
    });

    expect(adapter.isCaughtUp([matchedMentor])).toBe(true);

    const staleSkillMentor = makeMentor(1, {
      ...matchedMentor,
      have_skill: ['typescript'],
    });
    expect(adapter.isCaughtUp([staleSkillMentor])).toBe(false);

    const staleAvatarVersionMentor = makeMentor(1, {
      ...matchedMentor,
      avatar:
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1753999999999&cb=2026-11-14T00%3A00%3A00Z',
    });
    expect(adapter.isCaughtUp([staleAvatarVersionMentor])).toBe(false);

    const prefixTrapAvatarMentor = makeMentor(1, {
      ...matchedMentor,
      avatar:
        'https://s3.amazonaws.com/bucket/files/1/avatar?v=1754000000000999',
    });
    expect(adapter.isCaughtUp([prefixTrapAvatarMentor])).toBe(false);

    const staleTitleMentor = makeMentor(1, {
      ...matchedMentor,
      job_title: 'Stale Title',
    });
    expect(adapter.isCaughtUp([staleTitleMentor])).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const adapter = new SearchIndexSyncAdapter(1, makeCardFields());
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'profile_update',
      step: 'poll_mentor_pool_sync',
      message:
        'pollUntilMentorPoolSynced exhausted retries without confirmation',
    });
  });
});

describe('SearchIndexDeleteAdapter', () => {
  beforeEach(() => {
    mockFetchMentors.mockReset();
  });

  it('fetches mentors from index scoped to optional name', async () => {
    mockFetchMentors.mockResolvedValueOnce({ mentors: [], nextCursor: null });

    const adapter = new SearchIndexDeleteAdapter(1, 'Jane');
    const result = await adapter.fetch();

    expect(result).toEqual([]);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane',
      limit: 20,
    });
  });

  it('is caught up when target userId is absent from list', () => {
    const adapter = new SearchIndexDeleteAdapter(42, 'Jane');

    expect(adapter.isCaughtUp([makeMentor(1), makeMentor(2)])).toBe(true);
    expect(adapter.isCaughtUp([makeMentor(42)])).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const adapter = new SearchIndexDeleteAdapter(42, 'Jane');
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'delete_account',
      step: 'poll_deletion_sync',
      message: 'pollUntilUserDeleted exhausted retries without confirmation',
    });
  });
});

describe('hasProfileDtoConverged experience order & non-standard category guards (#905)', () => {
  type WireExperience = NonNullable<MentorProfileVO['experiences']>[number];

  it('treats reordered WORK/EDUCATION/LINK experience blocks as converged via decode normalization', () => {
    const workBlock: WireExperience = fromAny({
      category: 'WORK',
      order: 1,
      mentor_experiences_metadata: {
        data: [
          {
            job: 'Engineer',
            company: 'XChange',
            job_period_start: '2022',
            job_period_end: 'now',
            industry: 'TECH',
            job_location: 'TWN',
            description: 'Core platform',
            is_primary: true,
          },
        ],
      },
    });
    const eduBlock: WireExperience = fromAny({
      category: 'EDUCATION',
      order: 2,
      mentor_experiences_metadata: {
        data: [
          {
            subject: 'CS',
            school: 'NTU',
            education_period_start: '2018',
            education_period_end: '2022',
          },
        ],
      },
    });

    const expected = makeSyncedDto({ experiences: [workBlock, eduBlock] });
    const incomingReordered = makeSyncedDto({
      experiences: [eduBlock, workBlock],
    });
    expect(hasProfileDtoConverged(expected, incomingReordered)).toBe(true);
  });

  it('falls back to strict comparison instead of false-positive convergence when non-standard experience categories are present', () => {
    const customA: WireExperience = fromAny({
      category: 'CERTIFICATION',
      order: 1,
      mentor_experiences_metadata: { data: [{ name: 'AWS SA' }] },
    });
    const customB: WireExperience = fromAny({
      category: 'CERTIFICATION',
      order: 1,
      mentor_experiences_metadata: { data: [{ name: 'CKA' }] },
    });

    expect(
      hasProfileDtoConverged(
        makeSyncedDto({ experiences: [customA] }),
        makeSyncedDto({ experiences: [customB] })
      )
    ).toBe(false);
    expect(
      hasProfileDtoConverged(
        makeSyncedDto({ experiences: [customA] }),
        makeSyncedDto({ experiences: [customA] })
      )
    ).toBe(true);
  });
});
