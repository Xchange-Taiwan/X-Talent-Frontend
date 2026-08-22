import { captureFlowFailure } from '@/lib/monitoring';
import { isProfileSynced } from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';
import { fetchUserById } from '@/services/profile/user';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';
import type { MentorProfileVO } from '@/types/user';

// MENTOR_POOL_POLL_LIMIT constant
export const MENTOR_POOL_POLL_LIMIT = 20;

export interface MentorCardFields {
  name: string;
  jobTitle: string;
  company: string;
  about: string;
  yearsOfExperience: string;
  haveTopic: string[];
  avatar: string;
}

// Helper to compare arrays of topics
function sameTopics(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((topic, i) => topic === sortedB[i]);
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
 * Adapter for the DB-backed profile record (queries fetchUserById).
 */
export class ProfileRecordAdapter implements ConvergenceAdapter<MentorProfileVO> {
  constructor(
    private userId: number,
    private values: ProfileFormValues,
    private avatar: string
  ) {}

  async fetch(): Promise<MentorProfileVO | null> {
    try {
      return await fetchUserById(this.userId, 'zh_TW', undefined, true);
    } catch {
      return null;
    }
  }

  isCaughtUp(latest: MentorProfileVO): boolean {
    return isProfileSynced(this.values, latest, this.avatar);
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
export abstract class BaseSearchIndexAdapter implements ConvergenceAdapter<
  MentorType[]
> {
  constructor(protected userId: number) {}

  abstract getSearchPattern(): string;
  abstract isCaughtUp(mentors: MentorType[]): boolean;
  abstract getExhaustionMetadata(): {
    flow: string;
    step: string;
    message: string;
  };

  async fetch(): Promise<MentorType[] | null> {
    try {
      const result = await fetchMentors({
        search_pattern: this.getSearchPattern(),
        limit: MENTOR_POOL_POLL_LIMIT,
        cursor: '',
      });
      return result;
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
    private fields: MentorCardFields
  ) {
    super(userId);
  }

  getSearchPattern(): string {
    return this.fields.name;
  }

  isCaughtUp(mentors: MentorType[]): boolean {
    const card = mentors.find((mentor) => mentor.user_id === this.userId);
    if (!card) return false;

    // mapMentor appends `?cb=<updated_at>` to the avatar URL, so compare
    // by prefix rather than exact equality.
    const avatarSynced =
      !this.fields.avatar ||
      (typeof card.avatar === 'string' &&
        card.avatar.startsWith(this.fields.avatar));

    return (
      card.name === this.fields.name &&
      card.job_title === this.fields.jobTitle &&
      card.company === this.fields.company &&
      card.about === this.fields.about &&
      card.years_of_experience === this.fields.yearsOfExperience &&
      sameTopics(card.have_topic, this.fields.haveTopic) &&
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
    private name?: string
  ) {
    super(userId);
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

/**
 * One place to decide what happens when the budget is exhausted.
 */
export function handleExhaustion(flow: string, step: string, message: string) {
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
