import {
  addFavoriteMentor,
  fetchFavoriteMentors,
  removeFavoriteMentor,
} from '@/services/favorites';
import type { MentorType } from '@/types/mentor';

export interface FavoriteMentorState {
  favoriteMentorIds: ReadonlySet<number>;
  favoriteMentors: MentorType[];
  loadedUserId: string | null;
  isLoading: boolean;
  pendingMentorIds: ReadonlySet<number>;
}

export type ToggleFavoriteOutcome =
  | { status: 'added'; nextFavorited: true }
  | { status: 'removed'; nextFavorited: false }
  | { status: 'skipped'; nextFavorited: boolean }
  | { status: 'failed'; nextFavorited: boolean; error: unknown };

export interface FavoriteMentorServiceAdapter {
  fetchFavoriteMentors: (signal?: AbortSignal) => Promise<MentorType[]>;
  addFavoriteMentor: (mentorId: number, signal?: AbortSignal) => Promise<void>;
  removeFavoriteMentor: (
    mentorId: number,
    signal?: AbortSignal
  ) => Promise<void>;
}

const defaultAdapter: FavoriteMentorServiceAdapter = {
  fetchFavoriteMentors,
  addFavoriteMentor,
  removeFavoriteMentor,
};

function createInitialFavoriteState(): FavoriteMentorState {
  return {
    favoriteMentorIds: new Set<number>(),
    favoriteMentors: [],
    loadedUserId: null,
    isLoading: false,
    pendingMentorIds: new Set<number>(),
  };
}

const SERVER_SNAPSHOT: FavoriteMentorState = createInitialFavoriteState();

function buildPlaceholderMentor(mentorId: number): MentorType {
  return {
    user_id: mentorId,
    name: '',
    avatar: '',
    job_title: '',
    company: '',
    years_of_experience: '',
    location: '',
    personal_statement: '',
    about: '',
    seniority_level: '',
    industry: null,
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [],
    have_topic: [],
    updated_at: null,
    stats: null,
  };
}

class FavoriteMentorStoreManager {
  private state: FavoriteMentorState = createInitialFavoriteState();
  private listeners = new Set<() => void>();
  private activeUserId: string | null = null;
  private userEpoch = 0;
  private loadPromise: Promise<void> | null = null;
  private optimisticOverrides = new Map<
    number,
    { favorited: boolean; mentor?: MentorType }
  >();
  private adapter: FavoriteMentorServiceAdapter = defaultAdapter;

  getState = (): FavoriteMentorState => this.state;

  getServerSnapshot = (): FavoriteMentorState => SERVER_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private setState(patch: Partial<FavoriteMentorState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.emit();
  }

  setAdapter(adapter: FavoriteMentorServiceAdapter): void {
    this.adapter = adapter;
  }

  isFavorited(mentorId: number): boolean {
    return this.state.favoriteMentorIds.has(mentorId);
  }

  isPending(mentorId: number): boolean {
    return this.state.pendingMentorIds.has(mentorId);
  }

  /**
   * Synchronizes the store with the currently authenticated user ID.
   * Automatically loads `/v1/me/favorite-mentors` once per userId and resets
   * state upon logout or account switch.
   */
  syncUser(rawUserId: string | null | undefined): Promise<void> {
    const normalizedUserId = rawUserId?.trim() ? rawUserId.trim() : null;

    if (!normalizedUserId) {
      if (
        this.activeUserId !== null ||
        this.state.loadedUserId !== null ||
        this.state.favoriteMentorIds.size > 0 ||
        this.state.pendingMentorIds.size > 0 ||
        this.state.isLoading
      ) {
        this.activeUserId = null;
        this.userEpoch += 1;
        this.loadPromise = null;
        this.optimisticOverrides.clear();
        this.state = createInitialFavoriteState();
        this.emit();
      }
      return Promise.resolve();
    }

    if (this.activeUserId !== normalizedUserId) {
      this.activeUserId = normalizedUserId;
      this.userEpoch += 1;
      this.loadPromise = null;
      this.optimisticOverrides.clear();
      this.state = {
        ...createInitialFavoriteState(),
        isLoading: true,
      };
      this.emit();
    } else if (this.state.loadedUserId === normalizedUserId) {
      return Promise.resolve();
    } else if (this.loadPromise) {
      return this.loadPromise;
    } else {
      this.setState({ isLoading: true });
    }

    const requestEpoch = this.userEpoch;
    const targetUserId = normalizedUserId;

    const promise = this.adapter
      .fetchFavoriteMentors()
      .then((fetchedMentors) => {
        if (
          this.userEpoch !== requestEpoch ||
          this.activeUserId !== targetUserId
        ) {
          return;
        }

        const mergedIds = new Set<number>(
          fetchedMentors.map((mentor) => mentor.user_id)
        );
        const mentorMap = new Map<number, MentorType>();
        for (const mentor of fetchedMentors) {
          mentorMap.set(mentor.user_id, mentor);
        }

        // Preserve any optimistic mutations initiated while initial GET was in flight
        this.optimisticOverrides.forEach((override, id) => {
          if (override.favorited) {
            mergedIds.add(id);
            if (!mentorMap.has(id)) {
              mentorMap.set(id, override.mentor ?? buildPlaceholderMentor(id));
            }
          } else {
            mergedIds.delete(id);
            mentorMap.delete(id);
          }
        });

        this.setState({
          favoriteMentorIds: mergedIds,
          favoriteMentors: Array.from(mentorMap.values()),
          loadedUserId: targetUserId,
          isLoading: false,
        });
      })
      .catch(() => {
        if (
          this.userEpoch !== requestEpoch ||
          this.activeUserId !== targetUserId
        ) {
          return;
        }
        // Mark loadedUserId so transient failure doesn't cause an infinite refetch loop on re-renders
        this.setState({
          loadedUserId: targetUserId,
          isLoading: false,
        });
      })
      .finally(() => {
        if (this.loadPromise === promise) {
          this.loadPromise = null;
        }
      });

    this.loadPromise = promise;
    return promise;
  }

  /**
   * Optimistically toggles favorite state for `mentorId`, calling PUT or DELETE
   * and rolling back if the request fails.
   */
  async toggleFavorite(
    mentorId: number,
    mentorSnapshot?: MentorType
  ): Promise<ToggleFavoriteOutcome> {
    if (!Number.isFinite(mentorId) || mentorId <= 0) {
      return { status: 'skipped', nextFavorited: false };
    }

    const currentlyFavorited = this.state.favoriteMentorIds.has(mentorId);
    if (this.state.pendingMentorIds.has(mentorId)) {
      return { status: 'skipped', nextFavorited: currentlyFavorited };
    }

    const nextFavorited = !currentlyFavorited;
    const previousMentorEntry =
      this.state.favoriteMentors.find((item) => item.user_id === mentorId) ??
      null;
    const previousOverride = this.optimisticOverrides.get(mentorId);
    const requestEpoch = this.userEpoch;

    const nextIds = new Set(this.state.favoriteMentorIds);
    let nextMentors: MentorType[];

    if (nextFavorited) {
      nextIds.add(mentorId);
      const entryToInsert =
        mentorSnapshot ??
        previousMentorEntry ??
        buildPlaceholderMentor(mentorId);
      nextMentors = [
        entryToInsert,
        ...this.state.favoriteMentors.filter(
          (item) => item.user_id !== mentorId
        ),
      ];
    } else {
      nextIds.delete(mentorId);
      nextMentors = this.state.favoriteMentors.filter(
        (item) => item.user_id !== mentorId
      );
    }

    const nextPending = new Set(this.state.pendingMentorIds);
    nextPending.add(mentorId);
    this.optimisticOverrides.set(mentorId, {
      favorited: nextFavorited,
      mentor: mentorSnapshot ?? previousMentorEntry ?? undefined,
    });

    this.setState({
      favoriteMentorIds: nextIds,
      favoriteMentors: nextMentors,
      pendingMentorIds: nextPending,
    });

    try {
      if (nextFavorited) {
        await this.adapter.addFavoriteMentor(mentorId);
      } else {
        await this.adapter.removeFavoriteMentor(mentorId);
      }

      if (this.userEpoch === requestEpoch) {
        const updatedPending = new Set(this.state.pendingMentorIds);
        updatedPending.delete(mentorId);
        if (this.state.loadedUserId !== null) {
          this.optimisticOverrides.delete(mentorId);
        }
        this.setState({ pendingMentorIds: updatedPending });
      }

      return nextFavorited
        ? { status: 'added', nextFavorited: true }
        : { status: 'removed', nextFavorited: false };
    } catch (error) {
      if (this.userEpoch === requestEpoch) {
        const rolledBackIds = new Set(this.state.favoriteMentorIds);
        let rolledBackMentors: MentorType[];

        if (currentlyFavorited) {
          rolledBackIds.add(mentorId);
          const restoredEntry =
            previousMentorEntry ??
            mentorSnapshot ??
            buildPlaceholderMentor(mentorId);
          const withoutCurrent = this.state.favoriteMentors.filter(
            (item) => item.user_id !== mentorId
          );
          rolledBackMentors = [restoredEntry, ...withoutCurrent];
        } else {
          rolledBackIds.delete(mentorId);
          rolledBackMentors = this.state.favoriteMentors.filter(
            (item) => item.user_id !== mentorId
          );
        }

        const updatedPending = new Set(this.state.pendingMentorIds);
        updatedPending.delete(mentorId);

        if (previousOverride) {
          this.optimisticOverrides.set(mentorId, previousOverride);
        } else {
          this.optimisticOverrides.delete(mentorId);
        }

        this.setState({
          favoriteMentorIds: rolledBackIds,
          favoriteMentors: rolledBackMentors,
          pendingMentorIds: updatedPending,
        });
      }

      return {
        status: 'failed',
        nextFavorited: currentlyFavorited,
        error,
      };
    }
  }

  /**
   * Ensures `mentorId` is favorited for `userId` after synchronizing the user's
   * server favorites. Unlike `toggleFavorite`, if `mentorId` is already in
   * `favoriteMentorIds`, this method keeps it favorited without removing it.
   */
  async ensureFavorite(
    userId: string,
    mentorId: number,
    mentorSnapshot?: MentorType
  ): Promise<ToggleFavoriteOutcome> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !Number.isFinite(mentorId) || mentorId <= 0) {
      return { status: 'skipped', nextFavorited: false };
    }

    await this.syncUser(normalizedUserId);

    if (this.activeUserId !== normalizedUserId) {
      return { status: 'skipped', nextFavorited: false };
    }

    if (this.state.favoriteMentorIds.has(mentorId)) {
      return { status: 'skipped', nextFavorited: true };
    }

    return this.toggleFavorite(mentorId, mentorSnapshot);
  }

  /**
   * Seeds store state directly (useful for Storybook stories and deterministic tests).
   */
  seedFavorites(
    userId: string | null,
    items: ReadonlyArray<MentorType | number>
  ): void {
    const normalizedUserId = userId?.trim() ? userId.trim() : null;
    this.activeUserId = normalizedUserId;
    this.userEpoch += 1;
    this.loadPromise = null;
    this.optimisticOverrides.clear();

    const ids = new Set<number>();
    const mentors: MentorType[] = [];

    for (const item of items) {
      if (typeof item === 'number') {
        ids.add(item);
        mentors.push(buildPlaceholderMentor(item));
      } else {
        ids.add(item.user_id);
        mentors.push(item);
      }
    }

    this.state = {
      favoriteMentorIds: ids,
      favoriteMentors: mentors,
      loadedUserId: normalizedUserId,
      isLoading: false,
      pendingMentorIds: new Set<number>(),
    };
    this.emit();
  }

  reset(): void {
    this.activeUserId = null;
    this.userEpoch += 1;
    this.loadPromise = null;
    this.optimisticOverrides.clear();
    this.adapter = defaultAdapter;
    this.state = createInitialFavoriteState();
    this.emit();
  }
}

export const favoriteMentorStore = new FavoriteMentorStoreManager();

export function resetFavoriteMentorStore(): void {
  favoriteMentorStore.reset();
}
