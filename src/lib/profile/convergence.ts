import { hasAvatarVersionConverged } from '@/lib/avatar/avatarUrl';
import { captureFlowFailure } from '@/lib/monitoring';
import { decode, fromWireExperiences } from '@/lib/profile/experienceCodec';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { fetchUserById } from '@/services/profile/user';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorRequest, MentorType } from '@/types/mentor';
import type { MentorProfileVO } from '@/types/user';

const MENTOR_POOL_POLL_LIMIT = 20;

export type FetchProfileRecordFn = (
  userId: number,
  language?: string
) => Promise<MentorProfileVO | null>;

export type SearchMentorsFn = (request: MentorRequest) => Promise<MentorType[]>;

const defaultFetchProfileRecord: FetchProfileRecordFn = (
  userId,
  language = 'zh_TW'
) => fetchUserById(userId, language, undefined, true);

const defaultSearchMentors: SearchMentorsFn = async (request) => {
  const result = await fetchMentors(request);
  return result.mentors;
};

export interface MentorCardFields {
  name: string;
  jobTitle: string;
  company: string;
  about: string;
  yearsOfExperience: string;
  haveTopic: string[];
  haveSkill: string[];
  avatar: string;
}

function sameTagCodes(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((code, i) => code === sortedB[i]);
}

function hasScalarTextConverged(
  expected: string | null | undefined,
  incoming: string | null | undefined
): boolean {
  if (expected === undefined) return true;
  return (incoming ?? '') === (expected ?? '');
}

function hasNonStandardExperienceCategory(
  list: MentorProfileVO['experiences']
): boolean {
  if (!list || list.length === 0) return false;
  return list.some(
    (item) =>
      item.category !== 'WORK' &&
      item.category !== 'EDUCATION' &&
      item.category !== 'LINK'
  );
}

function haveExperiencesConverged(
  expected: MentorProfileVO['experiences'],
  incoming: MentorProfileVO['experiences']
): boolean {
  if (expected === undefined) return true;
  if (
    hasNonStandardExperienceCategory(expected) ||
    hasNonStandardExperienceCategory(incoming)
  ) {
    return (
      JSON.stringify(incoming ?? null) === JSON.stringify(expected ?? null)
    );
  }
  const decodedExpected = decode(fromWireExperiences(expected));
  const decodedIncoming = decode(fromWireExperiences(incoming));
  return JSON.stringify(decodedIncoming) === JSON.stringify(decodedExpected);
}

/**
 * Canonical full-field convergence check verifying whether an incoming backend
 * `MentorProfileVO` has caught up with an expected/optimistic profile state.
 *
 * Covers every editable profile field:
 * - Identity & role flags: `name`, `is_mentor`, `onboarding`, `avatar` (`?v=` across `&cb=`)
 * - Profile copy & metadata: `about`, `personal_statement`, `location`, `years_of_experience`, `industry`
 * - Primary work mirror & structured experiences: `job_title`, `company`, `experiences`
 * - Mentor & mentee tag buckets: `have_skill`, `have_topic`, `want_position`, `want_skill`, `want_topic`
 *
 * Fields left as `undefined` on `expected` impose no constraint, allowing both
 * full optimistic DTOs and partial projections to share a single predicate.
 */
export function hasProfileDtoConverged(
  expected: Partial<MentorProfileVO>,
  incoming: MentorProfileVO
): boolean {
  if (!hasScalarTextConverged(expected.name, incoming.name)) return false;

  if (
    expected.is_mentor !== undefined &&
    Boolean(incoming.is_mentor) !== Boolean(expected.is_mentor)
  ) {
    return false;
  }

  if (
    expected.onboarding !== undefined &&
    Boolean(incoming.onboarding) !== Boolean(expected.onboarding)
  ) {
    return false;
  }

  if (!hasScalarTextConverged(expected.job_title, incoming.job_title)) {
    return false;
  }
  if (!hasScalarTextConverged(expected.company, incoming.company)) {
    return false;
  }
  if (!hasScalarTextConverged(expected.about, incoming.about)) {
    return false;
  }
  if (
    !hasScalarTextConverged(
      expected.personal_statement,
      incoming.personal_statement
    )
  ) {
    return false;
  }
  if (!hasScalarTextConverged(expected.location, incoming.location)) {
    return false;
  }
  if (
    !hasScalarTextConverged(
      expected.years_of_experience,
      incoming.years_of_experience
    )
  ) {
    return false;
  }

  if (!hasAvatarVersionConverged(expected.avatar, incoming.avatar)) {
    return false;
  }

  if (
    expected.industry !== undefined &&
    (readIndustryTag(incoming.industry)?.subject_group ?? null) !==
      (readIndustryTag(expected.industry)?.subject_group ?? null)
  ) {
    return false;
  }

  if (!haveExperiencesConverged(expected.experiences, incoming.experiences)) {
    return false;
  }

  if (
    expected.have_skill !== undefined &&
    !sameTagCodes(expected.have_skill ?? [], incoming.have_skill ?? [])
  ) {
    return false;
  }
  if (
    expected.have_topic !== undefined &&
    !sameTagCodes(expected.have_topic ?? [], incoming.have_topic ?? [])
  ) {
    return false;
  }
  if (
    expected.want_position !== undefined &&
    !sameTagCodes(expected.want_position ?? [], incoming.want_position ?? [])
  ) {
    return false;
  }
  if (
    expected.want_skill !== undefined &&
    !sameTagCodes(expected.want_skill ?? [], incoming.want_skill ?? [])
  ) {
    return false;
  }
  if (
    expected.want_topic !== undefined &&
    !sameTagCodes(expected.want_topic ?? [], incoming.want_topic ?? [])
  ) {
    return false;
  }

  return true;
}

/**
 * Seam interface for convergence adapters.
 */
export interface ConvergenceAdapter<T> {
  fetch(): Promise<T | null>;
  isCaughtUp(data: T): boolean;
  getExhaustionMetadata(): {
    flow: string;
    step: string;
    message: string;
  };
}

/**
 * Adapter for the DB-backed profile record (queries fetchUserById by default).
 * Evaluates full-field convergence via `hasProfileDtoConverged`.
 */
export class ProfileRecordAdapter implements ConvergenceAdapter<MentorProfileVO> {
  private readonly language: string;

  constructor(
    private userId: number,
    private readonly expectedDto: Partial<MentorProfileVO>,
    private readonly fetchProfileFn: FetchProfileRecordFn = defaultFetchProfileRecord,
    language?: string
  ) {
    this.language = language || expectedDto.language || 'zh_TW';
  }

  async fetch(): Promise<MentorProfileVO | null> {
    try {
      return this.language !== 'zh_TW'
        ? await this.fetchProfileFn(this.userId, this.language)
        : await this.fetchProfileFn(this.userId);
    } catch {
      return null;
    }
  }

  isCaughtUp(latest: MentorProfileVO): boolean {
    return hasProfileDtoConverged(this.expectedDto, latest);
  }

  getExhaustionMetadata() {
    return {
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
    };
  }
}

/**
 * Shared base class for search-index adapters to eliminate code duplication.
 */
abstract class BaseSearchIndexAdapter implements ConvergenceAdapter<
  MentorType[]
> {
  constructor(
    protected userId: number,
    private searchMentorsFn: SearchMentorsFn = defaultSearchMentors
  ) {}

  abstract getSearchPattern(): string;
  abstract isCaughtUp(mentors: MentorType[]): boolean;
  abstract getExhaustionMetadata(): {
    flow: string;
    step: string;
    message: string;
  };

  async fetch(): Promise<MentorType[] | null> {
    try {
      return await this.searchMentorsFn({
        search_pattern: this.getSearchPattern(),
        limit: MENTOR_POOL_POLL_LIMIT,
      });
    } catch {
      return null;
    }
  }
}

/**
 * Adapter for the search-index mentor pool listing (queries fetchMentors to check update).
 */
export class SearchIndexSyncAdapter extends BaseSearchIndexAdapter {
  constructor(
    userId: number,
    private fields: MentorCardFields,
    searchMentorsFn?: SearchMentorsFn
  ) {
    super(userId, searchMentorsFn);
  }

  getSearchPattern(): string {
    return this.fields.name;
  }

  isCaughtUp(mentors: MentorType[]): boolean {
    const card = mentors.find((mentor) => mentor.user_id === this.userId);
    if (!card) return false;

    const avatarSynced =
      !this.fields.avatar ||
      hasAvatarVersionConverged(this.fields.avatar, card.avatar);

    return (
      card.name === this.fields.name &&
      card.job_title === this.fields.jobTitle &&
      card.company === this.fields.company &&
      card.about === this.fields.about &&
      card.years_of_experience === this.fields.yearsOfExperience &&
      sameTagCodes(card.have_topic ?? [], this.fields.haveTopic) &&
      sameTagCodes(card.have_skill ?? [], this.fields.haveSkill) &&
      avatarSynced
    );
  }

  getExhaustionMetadata() {
    return {
      flow: 'profile_update',
      step: 'poll_mentor_pool_sync',
      message:
        'pollUntilMentorPoolSynced exhausted retries without confirmation',
    };
  }
}

/**
 * Adapter for the search-index mentor pool listing (queries fetchMentors to check deletion).
 */
export class SearchIndexDeleteAdapter extends BaseSearchIndexAdapter {
  constructor(
    userId: number,
    private name?: string,
    searchMentorsFn?: SearchMentorsFn
  ) {
    super(userId, searchMentorsFn);
  }

  getSearchPattern(): string {
    return this.name ?? '';
  }

  isCaughtUp(mentors: MentorType[]): boolean {
    return !mentors.some((mentor) => mentor.user_id === this.userId);
  }

  getExhaustionMetadata() {
    return {
      flow: 'delete_account',
      step: 'poll_deletion_sync',
      message: 'pollUntilUserDeleted exhausted retries without confirmation',
    };
  }
}

// Single, unified budget
export const CONVERGENCE_BUDGET = {
  maxRetries: 12,
  intervalMs: 5000,
};

// Fast convergence budget for UI-blocking/Server Action scenarios
export const FAST_CONVERGENCE_BUDGET = {
  maxRetries: 6,
  intervalMs: 2000,
};

/**
 * One place to decide what happens when the budget is exhausted.
 */
function handleExhaustion(flow: string, step: string, message: string) {
  captureFlowFailure({
    flow,
    step,
    message,
    level: 'warning',
  });
}

/**
 * Generic convergence runner executing the single convergence loop policy.
 */
export async function runConvergence<T>(
  adapter: ConvergenceAdapter<T>,
  maxRetries = CONVERGENCE_BUDGET.maxRetries,
  intervalMs = CONVERGENCE_BUDGET.intervalMs
): Promise<{ confirmed: boolean; latest: T | null }> {
  let latest: T | null = null;
  let confirmed = false;

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      latest = await adapter.fetch();
      if (latest !== null && adapter.isCaughtUp(latest)) {
        confirmed = true;
        break;
      }
    } catch {
      // Inconclusive — keep retrying within budget.
    }
  }

  if (!confirmed) {
    const meta = adapter.getExhaustionMetadata();
    handleExhaustion(meta.flow, meta.step, meta.message);
  }

  return { confirmed, latest };
}
