import type { AnalyticsEvent } from '@/lib/analytics';
import * as analyticsModule from '@/lib/analytics';
import { AsyncReadManager, type AsyncReadResult } from '@/lib/asyncReadManager';
import { getSignInUrl } from '@/lib/routes';
import {
  addFavoriteMentor,
  fetchFavoriteMentors,
  removeFavoriteMentor,
} from '@/services/favorites';
import type { MentorType } from '@/types/mentor';

import {
  clearPendingFavoriteMentor,
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from './pendingFavoriteStorage';

export type FavoriteMentorFeature = 'mentor_pool' | 'profile' | 'favorites';

export interface FavoriteMentorsSnapshot {
  mentors: MentorType[];
  mentorIds: ReadonlySet<number>;
}

export type BookmarkActionOutcome =
  | { status: 'added'; nextFavorited: true }
  | { status: 'removed'; nextFavorited: false }
  | { status: 'already_favorited'; nextFavorited: true }
  | { status: 'guest_redirect'; signInUrl: string; nextFavorited: false }
  | { status: 'self_blocked'; nextFavorited: false }
  | { status: 'non_mentor'; nextFavorited: false }
  | { status: 'noop'; nextFavorited: boolean }
  | { status: 'skipped'; nextFavorited: boolean }
  | { status: 'aborted'; nextFavorited: boolean }
  | { status: 'failed'; nextFavorited: boolean; error: unknown };

export interface FavoriteMentorsTransport {
  fetchFavoriteMentors: (signal?: AbortSignal) => Promise<MentorType[]>;
  addFavoriteMentor: (mentorId: number, signal?: AbortSignal) => Promise<void>;
  removeFavoriteMentor: (
    mentorId: number,
    signal?: AbortSignal
  ) => Promise<void>;
}

export interface PendingFavoriteStoragePort {
  savePending: (mentorId: number, now?: number) => void;
  getPendingMentorId: (now?: number) => number | null;
  clearPending: () => void;
}

export interface CreateFavoriteMentorsReadModelOptions {
  transport?: Partial<FavoriteMentorsTransport>;
  storage?: PendingFavoriteStoragePort;
  trackAnalytics?: (event: AnalyticsEvent) => void;
  now?: () => number;
}

export interface FavoriteMentorsReadModel {
  subscribe(
    userId: string,
    onUpdate: (res: AsyncReadResult<FavoriteMentorsSnapshot>) => void,
    opts?: { force?: boolean }
  ): () => void;
  subscribeMentorState(
    userId: string | null,
    mentorId: number,
    onChange: () => void
  ): () => void;
  getMentorState(
    userId: string | null,
    mentorId: number
  ): { isFavorited: boolean; isPending: boolean; isSelf: boolean };
  toggle(params: {
    userId: string | null;
    mentorId: number;
    mentorSnapshot?: MentorType;
    feature: FavoriteMentorFeature;
  }): Promise<BookmarkActionOutcome>;
  replayPendingForPage(params: {
    userId: string;
    pageMentorId: number;
    mentor: { isMentor: boolean; snapshot?: MentorType };
  }): Promise<BookmarkActionOutcome>;
  retry(userId: string): Promise<void>;
  seed(userId: string | null, mentors: Array<MentorType | number>): void;
  setTransport(transport?: Partial<FavoriteMentorsTransport>): void;
  getSnapshot(userId: string): FavoriteMentorsSnapshot | undefined;
  clear(): void;
}

const defaultTransport: FavoriteMentorsTransport = {
  fetchFavoriteMentors,
  addFavoriteMentor,
  removeFavoriteMentor,
};

const defaultStoragePort: PendingFavoriteStoragePort = {
  savePending: savePendingFavoriteMentor,
  getPendingMentorId: getPendingFavoriteMentorId,
  clearPending: clearPendingFavoriteMentor,
};

function normalizeUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidMentorId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function getMentorKey(userId: string, mentorId: number): string {
  return `${userId}:${mentorId}`;
}

interface UserMutationState {
  serverMentors: MentorType[];
  hasLoadedServer: boolean;
  confirmedIdOnly: Set<number>;
  settledBeforeLoad: Map<number, { favorited: boolean; snapshot?: MentorType }>;
  optimistic: Map<number, { favorited: boolean; snapshot?: MentorType }>;
  pendingIds: Set<number>;
  controllers: Set<AbortController>;
}

export function createFavoriteMentorsReadModel(
  options: CreateFavoriteMentorsReadModelOptions = {}
): FavoriteMentorsReadModel {
  let transport: FavoriteMentorsTransport = {
    ...defaultTransport,
    ...options.transport,
  };
  const storage = options.storage ?? defaultStoragePort;
  const trackAnalytics =
    options.trackAnalytics ??
    ((event: AnalyticsEvent) => {
      analyticsModule.trackEvent(event);
    });
  const now = options.now ?? (() => Date.now());

  const readManager = new AsyncReadManager<string, FavoriteMentorsSnapshot>();
  const userStates = new Map<string, UserMutationState>();
  const mentorListeners = new Map<string, Set<() => void>>();
  const sharedReadUnsubscribers = new Map<string, () => void>();
  const sharedReadRefCounts = new Map<string, number>();
  const inflightReplays = new Map<string, Promise<BookmarkActionOutcome>>();

  let activeUserId: string | null = null;

  function getOrCreateUserState(userId: string): UserMutationState {
    const existing = userStates.get(userId);
    if (existing) {
      return existing;
    }
    const created: UserMutationState = {
      serverMentors: [],
      hasLoadedServer: false,
      confirmedIdOnly: new Set<number>(),
      settledBeforeLoad: new Map(),
      optimistic: new Map(),
      pendingIds: new Set<number>(),
      controllers: new Set<AbortController>(),
    };
    userStates.set(userId, created);
    return created;
  }

  function notifyMentorListeners(userId: string, mentorIds: Iterable<number>) {
    Array.from(mentorIds).forEach((mentorId) => {
      const listeners = mentorListeners.get(getMentorKey(userId, mentorId));
      if (!listeners) return;
      Array.from(listeners).forEach((listener) => {
        if (listeners.has(listener)) {
          listener();
        }
      });
    });
  }

  function notifyAllMentorListenersForUser(userId: string): void {
    const prefix = `${userId}:`;
    Array.from(mentorListeners.entries()).forEach(([key, listeners]) => {
      if (!key.startsWith(prefix)) return;
      Array.from(listeners).forEach((listener) => {
        if (listeners.has(listener)) {
          listener();
        }
      });
    });
  }

  function computeEffectiveMentorIds(state: UserMutationState): Set<number> {
    const ids = new Set<number>();
    state.serverMentors.forEach((mentor) => {
      if (isValidMentorId(mentor.user_id)) {
        ids.add(mentor.user_id);
      }
    });
    Array.from(state.confirmedIdOnly).forEach((id) => {
      ids.add(id);
    });
    Array.from(state.optimistic.entries()).forEach(([mentorId, entry]) => {
      if (entry.favorited) {
        ids.add(mentorId);
      } else {
        ids.delete(mentorId);
      }
    });
    return ids;
  }

  function computeSnapshot(userId: string): FavoriteMentorsSnapshot {
    const state = getOrCreateUserState(userId);
    const mentorIds = computeEffectiveMentorIds(state);
    const byId = new Map<number, MentorType>();

    // Optimistic newly-added snapshots appear first while preserving server ordering
    Array.from(state.optimistic.entries()).forEach(([mentorId, entry]) => {
      if (entry.favorited && entry.snapshot && mentorIds.has(mentorId)) {
        byId.set(mentorId, entry.snapshot);
      }
    });

    state.serverMentors.forEach((mentor) => {
      if (mentorIds.has(mentor.user_id) && !byId.has(mentor.user_id)) {
        byId.set(mentor.user_id, mentor);
      }
    });

    return {
      mentors: Array.from(byId.values()),
      mentorIds,
    };
  }

  function publishSnapshotIfLoaded(userId: string): void {
    const state = userStates.get(userId);
    if (!state || !state.hasLoadedServer) {
      return;
    }
    readManager.set(userId, computeSnapshot(userId));
  }

  function buildFetcher(userId: string) {
    return async (signal: AbortSignal): Promise<FavoriteMentorsSnapshot> => {
      const state = getOrCreateUserState(userId);
      const prevIds = computeEffectiveMentorIds(state);
      const fetched = await transport.fetchFavoriteMentors(signal);
      if (signal.aborted) {
        return computeSnapshot(userId);
      }

      const deduped: MentorType[] = [];
      const seen = new Set<number>();
      fetched.forEach((mentor) => {
        if (isValidMentorId(mentor.user_id) && !seen.has(mentor.user_id)) {
          seen.add(mentor.user_id);
          deduped.push(mentor);
          state.confirmedIdOnly.delete(mentor.user_id);
        }
      });

      // Re-apply any mutations that settled while this initial GET was in flight
      let mergedServer = deduped;
      let needsPostLoadRefresh = false;
      if (state.settledBeforeLoad.size > 0) {
        Array.from(state.settledBeforeLoad.entries()).forEach(
          ([mentorId, settled]) => {
            if (settled.favorited) {
              if (settled.snapshot) {
                state.confirmedIdOnly.delete(mentorId);
                mergedServer = [
                  settled.snapshot,
                  ...mergedServer.filter((m) => m.user_id !== mentorId),
                ];
              } else if (!mergedServer.some((m) => m.user_id === mentorId)) {
                state.confirmedIdOnly.add(mentorId);
                needsPostLoadRefresh = true;
              }
            } else {
              state.confirmedIdOnly.delete(mentorId);
              mergedServer = mergedServer.filter((m) => m.user_id !== mentorId);
            }
          }
        );
        state.settledBeforeLoad.clear();
      }

      state.serverMentors = mergedServer;
      state.hasLoadedServer = true;

      if (needsPostLoadRefresh) {
        void readManager.refresh(userId, buildFetcher(userId));
      }

      // Drop any non-pending optimistic overrides superseded by server truth
      Array.from(state.optimistic.keys()).forEach((mentorId) => {
        if (!state.pendingIds.has(mentorId)) {
          state.optimistic.delete(mentorId);
        }
      });

      const snapshot = computeSnapshot(userId);
      const changedIds = new Set<number>();
      Array.from(prevIds).forEach((id) => {
        if (!snapshot.mentorIds.has(id)) changedIds.add(id);
      });
      Array.from(snapshot.mentorIds).forEach((id) => {
        if (!prevIds.has(id)) changedIds.add(id);
      });

      if (changedIds.size > 0) {
        notifyMentorListeners(userId, changedIds);
      }

      return snapshot;
    };
  }

  function teardownUser(userId: string): void {
    const sharedUnsub = sharedReadUnsubscribers.get(userId);
    if (sharedUnsub) {
      sharedReadUnsubscribers.delete(userId);
      sharedReadRefCounts.delete(userId);
      sharedUnsub();
    }

    const state = userStates.get(userId);
    if (state) {
      Array.from(state.controllers).forEach((controller) => {
        controller.abort();
      });
      state.controllers.clear();
      state.pendingIds.clear();
      state.optimistic.clear();
      state.settledBeforeLoad.clear();
      state.confirmedIdOnly.clear();
      state.serverMentors = [];
      state.hasLoadedServer = false;
      userStates.delete(userId);
    }

    Array.from(inflightReplays.keys()).forEach((key) => {
      if (key.startsWith(`${userId}:`)) {
        inflightReplays.delete(key);
      }
    });

    readManager.invalidate(userId);
    notifyAllMentorListenersForUser(userId);
  }

  function ensureActiveUser(userId: string): void {
    if (activeUserId !== null && activeUserId !== userId) {
      teardownUser(activeUserId);
    }
    activeUserId = userId;
  }

  function retainSharedUserRead(userId: string): () => void {
    ensureActiveUser(userId);
    const prevCount = sharedReadRefCounts.get(userId) ?? 0;
    sharedReadRefCounts.set(userId, prevCount + 1);

    if (!sharedReadUnsubscribers.has(userId)) {
      const unsub = readManager.subscribe(userId, buildFetcher(userId), () => {
        // Snapshot updates already notify changed mentor keys inside buildFetcher.
      });
      sharedReadUnsubscribers.set(userId, unsub);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = sharedReadRefCounts.get(userId) ?? 0;
      if (current <= 1) {
        sharedReadRefCounts.delete(userId);
        const unsub = sharedReadUnsubscribers.get(userId);
        if (unsub) {
          sharedReadUnsubscribers.delete(userId);
          unsub();
        }
      } else {
        sharedReadRefCounts.set(userId, current - 1);
      }
    };
  }

  function subscribe(
    rawUserId: string,
    onUpdate: (res: AsyncReadResult<FavoriteMentorsSnapshot>) => void,
    opts?: { force?: boolean }
  ): () => void {
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
      onUpdate({ data: null, isLoading: false, error: null });
      return () => {};
    }
    ensureActiveUser(userId);
    return readManager.subscribe(userId, buildFetcher(userId), onUpdate, {
      force: opts?.force,
    });
  }

  function subscribeMentorState(
    rawUserId: string | null,
    mentorId: number,
    onChange: () => void
  ): () => void {
    const userId = normalizeUserId(rawUserId);
    if (!userId || !isValidMentorId(mentorId) || userId === String(mentorId)) {
      return () => {};
    }

    const key = getMentorKey(userId, mentorId);
    let listeners = mentorListeners.get(key);
    if (!listeners) {
      listeners = new Set();
      mentorListeners.set(key, listeners);
    }
    listeners.add(onChange);

    const releaseSharedRead = retainSharedUserRead(userId);

    return () => {
      const currentListeners = mentorListeners.get(key);
      if (currentListeners) {
        currentListeners.delete(onChange);
        if (currentListeners.size === 0) {
          mentorListeners.delete(key);
        }
      }
      releaseSharedRead();
    };
  }

  function getMentorState(
    rawUserId: string | null,
    mentorId: number
  ): { isFavorited: boolean; isPending: boolean; isSelf: boolean } {
    const userId = normalizeUserId(rawUserId);
    if (!userId || !isValidMentorId(mentorId)) {
      return { isFavorited: false, isPending: false, isSelf: false };
    }
    if (userId === String(mentorId)) {
      return { isFavorited: false, isPending: false, isSelf: true };
    }
    const state = userStates.get(userId);
    if (!state) {
      return { isFavorited: false, isPending: false, isSelf: false };
    }
    const effectiveIds = computeEffectiveMentorIds(state);
    return {
      isFavorited: effectiveIds.has(mentorId),
      isPending: state.pendingIds.has(mentorId),
      isSelf: false,
    };
  }

  async function toggle(params: {
    userId: string | null;
    mentorId: number;
    mentorSnapshot?: MentorType;
    feature: FavoriteMentorFeature;
  }): Promise<BookmarkActionOutcome> {
    const { mentorId, mentorSnapshot, feature } = params;
    if (!isValidMentorId(mentorId)) {
      return { status: 'noop', nextFavorited: false };
    }

    const userId = normalizeUserId(params.userId);
    if (!userId) {
      storage.savePending(mentorId, now());
      return {
        status: 'guest_redirect',
        signInUrl: getSignInUrl(`/profile/${mentorId}`),
        nextFavorited: false,
      };
    }

    if (userId === String(mentorId)) {
      return { status: 'self_blocked', nextFavorited: false };
    }

    ensureActiveUser(userId);
    const state = getOrCreateUserState(userId);

    if (!state.hasLoadedServer) {
      void readManager.prefetch(userId, buildFetcher(userId));
    }

    const currentIds = computeEffectiveMentorIds(state);
    const currentlyFavorited = currentIds.has(mentorId);

    if (state.pendingIds.has(mentorId)) {
      return { status: 'skipped', nextFavorited: currentlyFavorited };
    }

    const nextFavorited = !currentlyFavorited;
    const action = nextFavorited ? 'add' : 'remove';
    const normalizedSnapshot =
      mentorSnapshot && mentorSnapshot.user_id === mentorId
        ? mentorSnapshot
        : undefined;

    state.pendingIds.add(mentorId);
    state.optimistic.set(mentorId, {
      favorited: nextFavorited,
      snapshot: normalizedSnapshot,
    });
    publishSnapshotIfLoaded(userId);
    notifyMentorListeners(userId, [mentorId]);

    const controller = new AbortController();
    state.controllers.add(controller);

    try {
      if (nextFavorited) {
        await transport.addFavoriteMentor(mentorId, controller.signal);
      } else {
        await transport.removeFavoriteMentor(mentorId, controller.signal);
      }

      state.controllers.delete(controller);
      if (controller.signal.aborted || activeUserId !== userId) {
        return { status: 'aborted', nextFavorited: false };
      }

      state.pendingIds.delete(mentorId);
      state.optimistic.delete(mentorId);

      if (!state.hasLoadedServer) {
        state.settledBeforeLoad.set(mentorId, {
          favorited: nextFavorited,
          snapshot: normalizedSnapshot,
        });
      }

      let needsBackgroundRefresh = false;
      if (nextFavorited) {
        if (normalizedSnapshot) {
          state.confirmedIdOnly.delete(mentorId);
          const filtered = state.serverMentors.filter(
            (m) => m.user_id !== mentorId
          );
          state.serverMentors = [normalizedSnapshot, ...filtered];
        } else {
          const alreadyHasCard = state.serverMentors.some(
            (m) => m.user_id === mentorId
          );
          if (!alreadyHasCard) {
            state.confirmedIdOnly.add(mentorId);
            needsBackgroundRefresh = true;
          }
        }
      } else {
        state.confirmedIdOnly.delete(mentorId);
        state.serverMentors = state.serverMentors.filter(
          (m) => m.user_id !== mentorId
        );
      }

      publishSnapshotIfLoaded(userId);
      if (needsBackgroundRefresh) {
        void readManager.refresh(userId, buildFetcher(userId));
      }
      notifyMentorListeners(userId, [mentorId]);

      trackAnalytics({
        name: 'mentor_bookmark_toggle',
        feature,
        metadata: {
          mentor_id: mentorId,
          action,
        },
      });

      return nextFavorited
        ? { status: 'added', nextFavorited: true }
        : { status: 'removed', nextFavorited: false };
    } catch (error) {
      state.controllers.delete(controller);
      if (controller.signal.aborted || activeUserId !== userId) {
        return { status: 'aborted', nextFavorited: false };
      }

      state.pendingIds.delete(mentorId);
      state.optimistic.delete(mentorId);
      publishSnapshotIfLoaded(userId);
      notifyMentorListeners(userId, [mentorId]);

      const settledFavorited = computeEffectiveMentorIds(state).has(mentorId);
      return {
        status: 'failed',
        nextFavorited: settledFavorited,
        error,
      };
    }
  }

  async function replayPendingForPage(params: {
    userId: string;
    pageMentorId: number;
    mentor: { isMentor: boolean; snapshot?: MentorType };
  }): Promise<BookmarkActionOutcome> {
    const userId = normalizeUserId(params.userId);
    const { pageMentorId, mentor } = params;

    if (!userId || !isValidMentorId(pageMentorId)) {
      return { status: 'noop', nextFavorited: false };
    }

    const pendingMentorId = storage.getPendingMentorId(now());
    if (pendingMentorId === null || pendingMentorId !== pageMentorId) {
      return {
        status: 'noop',
        nextFavorited: getMentorState(userId, pageMentorId).isFavorited,
      };
    }

    if (userId === String(pageMentorId)) {
      storage.clearPending();
      return { status: 'self_blocked', nextFavorited: false };
    }

    if (!mentor.isMentor) {
      storage.clearPending();
      return { status: 'non_mentor', nextFavorited: false };
    }

    const replayKey = getMentorKey(userId, pageMentorId);
    const existingReplay = inflightReplays.get(replayKey);
    if (existingReplay) {
      return existingReplay;
    }

    const replayPromise = (async (): Promise<BookmarkActionOutcome> => {
      ensureActiveUser(userId);
      const state = getOrCreateUserState(userId);

      if (!state.hasLoadedServer) {
        const loaded = await readManager.prefetch(userId, buildFetcher(userId));
        if (activeUserId !== userId || loaded === null) {
          return { status: 'aborted', nextFavorited: false };
        }
      }

      if (computeEffectiveMentorIds(state).has(pageMentorId)) {
        storage.clearPending();
        return { status: 'already_favorited', nextFavorited: true };
      }

      const outcome = await toggle({
        userId,
        mentorId: pageMentorId,
        mentorSnapshot: mentor.snapshot,
        feature: 'profile',
      });

      if (outcome.status === 'added') {
        storage.clearPending();
      }

      return outcome;
    })().finally(() => {
      if (inflightReplays.get(replayKey) === replayPromise) {
        inflightReplays.delete(replayKey);
      }
    });

    inflightReplays.set(replayKey, replayPromise);
    return replayPromise;
  }

  async function retry(rawUserId: string): Promise<void> {
    const userId = normalizeUserId(rawUserId);
    if (!userId) return;
    ensureActiveUser(userId);
    await readManager.refresh(userId, buildFetcher(userId));
  }

  function seed(
    rawUserId: string | null,
    mentors: Array<MentorType | number>
  ): void {
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
      clear();
      return;
    }
    ensureActiveUser(userId);
    const state = getOrCreateUserState(userId);
    state.pendingIds.clear();
    state.optimistic.clear();
    state.settledBeforeLoad.clear();
    state.confirmedIdOnly.clear();

    const fullMentors: MentorType[] = [];
    mentors.forEach((entry) => {
      if (typeof entry === 'number') {
        if (isValidMentorId(entry)) {
          state.confirmedIdOnly.add(entry);
        }
      } else if (isValidMentorId(entry.user_id)) {
        fullMentors.push(entry);
      }
    });

    state.serverMentors = fullMentors;
    state.hasLoadedServer = true;
    readManager.set(userId, computeSnapshot(userId));
    notifyAllMentorListenersForUser(userId);
  }

  function setTransport(next?: Partial<FavoriteMentorsTransport>): void {
    transport = {
      ...defaultTransport,
      ...next,
    };
  }

  function getSnapshot(rawUserId: string): FavoriteMentorsSnapshot | undefined {
    const userId = normalizeUserId(rawUserId);
    if (!userId) return undefined;
    return readManager.get(userId);
  }

  function clear(): void {
    Array.from(sharedReadUnsubscribers.values()).forEach((unsub) => {
      unsub();
    });
    sharedReadUnsubscribers.clear();
    sharedReadRefCounts.clear();

    Array.from(userStates.keys()).forEach((userId) => {
      const state = userStates.get(userId);
      if (state) {
        Array.from(state.controllers).forEach((controller) => {
          controller.abort();
        });
        state.controllers.clear();
      }
    });
    userStates.clear();
    inflightReplays.clear();
    activeUserId = null;
    readManager.clear();

    Array.from(mentorListeners.values()).forEach((listeners) => {
      Array.from(listeners).forEach((listener) => {
        if (listeners.has(listener)) {
          listener();
        }
      });
    });
  }

  return {
    subscribe,
    subscribeMentorState,
    getMentorState,
    toggle,
    replayPendingForPage,
    retry,
    seed,
    setTransport,
    getSnapshot,
    clear,
  };
}

export const favoriteMentorsReadModel: FavoriteMentorsReadModel =
  createFavoriteMentorsReadModel();

export function resetFavoriteMentorsReadModel(): void {
  favoriteMentorsReadModel.setTransport();
  favoriteMentorsReadModel.clear();
}
