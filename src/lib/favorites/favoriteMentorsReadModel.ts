import type { AnalyticsEvent } from '@/lib/analytics';
import * as analyticsModule from '@/lib/analytics';
import { isFavoritesEnabled } from '@/lib/featureFlags';
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

export type FavoritesListStatus = 'loading' | 'error' | 'empty' | 'success';

export interface MentorBookmarkState {
  readonly isFavorited: boolean;
  readonly isPending: boolean;
  readonly isSelf: boolean;
}

export interface FavoriteMentorsSnapshot {
  readonly mentors: MentorType[];
  readonly mentorIds: ReadonlySet<number>;
  readonly listStatus: FavoritesListStatus;
  readonly isLoading: boolean;
  readonly isStoreReadyForUser: boolean;
  readonly error: Error | null;
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
  fetchFavoriteMentors: (
    userId: string,
    signal?: AbortSignal
  ) => Promise<MentorType[]>;
  addFavoriteMentor: (
    userId: string,
    mentorId: number,
    signal?: AbortSignal
  ) => Promise<void>;
  removeFavoriteMentor: (
    userId: string,
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
    onChange: (snapshot: FavoriteMentorsSnapshot) => void,
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
  ): MentorBookmarkState;
  getListSnapshot(userId: string | null): FavoriteMentorsSnapshot;
  toggle(params: {
    userId: string | null;
    mentorId: number;
    mentorSnapshot?: MentorType;
    feature: FavoriteMentorFeature;
  }): Promise<BookmarkActionOutcome>;
  replayPendingForPage(params: {
    userId: string;
    pageMentorId: number;
    mentor: { isMentor: boolean; snapshot?: MentorType } | null;
  }): Promise<BookmarkActionOutcome>;
  retry(userId: string): Promise<void>;
  seed(userId: string | null, mentors: Array<MentorType | number>): void;
  setTransport(transport?: Partial<FavoriteMentorsTransport>): void;
  getSnapshot(userId: string): FavoriteMentorsSnapshot | undefined;
  clear(): void;
}

const NOOP_UNSUBSCRIBE = (): void => {};

const EMPTY_MENTORS: MentorType[] = [];
Object.freeze(EMPTY_MENTORS);

const EMPTY_MENTOR_IDS: ReadonlySet<number> = new Set<number>();

const LOADING_LIST_SNAPSHOT: FavoriteMentorsSnapshot = Object.freeze({
  mentors: EMPTY_MENTORS,
  mentorIds: EMPTY_MENTOR_IDS,
  listStatus: 'loading',
  isLoading: true,
  isStoreReadyForUser: false,
  error: null,
});

const DISABLED_LIST_SNAPSHOT: FavoriteMentorsSnapshot = Object.freeze({
  mentors: EMPTY_MENTORS,
  mentorIds: EMPTY_MENTOR_IDS,
  listStatus: 'empty',
  isLoading: false,
  isStoreReadyForUser: false,
  error: null,
});

const EMPTY_READY_LIST_SNAPSHOT: FavoriteMentorsSnapshot = Object.freeze({
  mentors: EMPTY_MENTORS,
  mentorIds: EMPTY_MENTOR_IDS,
  listStatus: 'empty',
  isLoading: false,
  isStoreReadyForUser: true,
  error: null,
});

const MENTOR_STATE_SINGLETONS: readonly MentorBookmarkState[] = [
  Object.freeze({ isFavorited: false, isPending: false, isSelf: false }),
  Object.freeze({ isFavorited: true, isPending: false, isSelf: false }),
  Object.freeze({ isFavorited: false, isPending: true, isSelf: false }),
  Object.freeze({ isFavorited: true, isPending: true, isSelf: false }),
  Object.freeze({ isFavorited: false, isPending: false, isSelf: true }),
  Object.freeze({ isFavorited: true, isPending: false, isSelf: true }),
  Object.freeze({ isFavorited: false, isPending: true, isSelf: true }),
  Object.freeze({ isFavorited: true, isPending: true, isSelf: true }),
];

function selectMentorStateSingleton(
  isFavorited: boolean,
  isPending: boolean,
  isSelf: boolean
): MentorBookmarkState {
  const index = (isFavorited ? 1 : 0) | (isPending ? 2 : 0) | (isSelf ? 4 : 0);
  return MENTOR_STATE_SINGLETONS[index];
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

function areSetsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  let equal = true;
  a.forEach((value) => {
    if (!b.has(value)) {
      equal = false;
    }
  });
  return equal;
}

function areMentorListsEqual(a: MentorType[], b: MentorType[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

type ActiveSessionStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SettledMutationEntry {
  favorited: boolean;
  snapshot?: MentorType;
}

interface ListSubscriberEntry {
  userId: string;
  onChange: (snapshot: FavoriteMentorsSnapshot) => void;
}

interface ActiveUserSession {
  userId: string;
  status: ActiveSessionStatus;
  mentors: MentorType[];
  confirmedIdOnly: Set<number>;
  settledBeforeLoad: Map<number, SettledMutationEntry>;
  optimistic: Map<number, SettledMutationEntry>;
  pendingIds: Set<number>;
  error: Error | null;
  controllers: Set<AbortController>;
  fetchController: AbortController | null;
  fetchPromise: Promise<'loaded' | 'error' | 'aborted'> | null;
  inflightReplays: Map<number, Promise<BookmarkActionOutcome>>;
  effectiveMentorIds: ReadonlySet<number>;
  effectiveMentors: MentorType[];
  dataSnapshot: FavoriteMentorsSnapshot | undefined;
  listSnapshot: FavoriteMentorsSnapshot;
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

  let activeSession: ActiveUserSession | null = null;
  const listListeners = new Set<ListSubscriberEntry>();
  const mentorListeners = new Map<number, Set<() => void>>();

  function createSession(userId: string): ActiveUserSession {
    return {
      userId,
      status: 'idle',
      mentors: EMPTY_MENTORS,
      confirmedIdOnly: new Set<number>(),
      settledBeforeLoad: new Map(),
      optimistic: new Map(),
      pendingIds: new Set<number>(),
      error: null,
      controllers: new Set<AbortController>(),
      fetchController: null,
      fetchPromise: null,
      inflightReplays: new Map(),
      effectiveMentorIds: EMPTY_MENTOR_IDS,
      effectiveMentors: EMPTY_MENTORS,
      dataSnapshot: undefined,
      listSnapshot: LOADING_LIST_SNAPSHOT,
    };
  }

  function computeEffectiveMentorIds(session: ActiveUserSession): Set<number> {
    const ids = new Set<number>();
    session.mentors.forEach((mentor) => {
      if (isValidMentorId(mentor.user_id)) {
        ids.add(mentor.user_id);
      }
    });
    session.confirmedIdOnly.forEach((id) => {
      ids.add(id);
    });
    session.optimistic.forEach((entry, mentorId) => {
      if (entry.favorited) {
        ids.add(mentorId);
      } else {
        ids.delete(mentorId);
      }
    });
    return ids;
  }

  function computeEffectiveMentors(
    session: ActiveUserSession,
    mentorIds: ReadonlySet<number>
  ): MentorType[] {
    if (mentorIds.size === 0) {
      return EMPTY_MENTORS;
    }
    const byId = new Map<number, MentorType>();

    // Optimistic newly-added snapshots appear first while preserving server ordering
    session.optimistic.forEach((entry, mentorId) => {
      if (entry.favorited && entry.snapshot && mentorIds.has(mentorId)) {
        byId.set(mentorId, entry.snapshot);
      }
    });

    session.mentors.forEach((mentor) => {
      if (mentorIds.has(mentor.user_id) && !byId.has(mentor.user_id)) {
        byId.set(mentor.user_id, mentor);
      }
    });

    return byId.size > 0 ? Array.from(byId.values()) : EMPTY_MENTORS;
  }

  function syncSessionSnapshots(session: ActiveUserSession): boolean {
    const prevListSnapshot = session.listSnapshot;
    const rawIds = computeEffectiveMentorIds(session);
    const stableIds: ReadonlySet<number> =
      rawIds.size === 0
        ? EMPTY_MENTOR_IDS
        : areSetsEqual(session.effectiveMentorIds, rawIds)
          ? session.effectiveMentorIds
          : rawIds;

    const rawMentors = computeEffectiveMentors(session, stableIds);
    const stableMentors =
      rawMentors.length === 0
        ? EMPTY_MENTORS
        : areMentorListsEqual(session.effectiveMentors, rawMentors)
          ? session.effectiveMentors
          : rawMentors;

    session.effectiveMentorIds = stableIds;
    session.effectiveMentors = stableMentors;

    if (session.status === 'idle' || session.status === 'loading') {
      session.dataSnapshot = undefined;
      session.listSnapshot = LOADING_LIST_SNAPSHOT;
      return !Object.is(prevListSnapshot, session.listSnapshot);
    }

    if (session.status === 'error') {
      session.dataSnapshot = undefined;
      if (
        prevListSnapshot.listStatus === 'error' &&
        Object.is(prevListSnapshot.error, session.error)
      ) {
        return false;
      }
      session.listSnapshot = Object.freeze({
        mentors: EMPTY_MENTORS,
        mentorIds: EMPTY_MENTOR_IDS,
        listStatus: 'error',
        isLoading: false,
        isStoreReadyForUser: true,
        error: session.error,
      });
      return true;
    }

    const nextListStatus: FavoritesListStatus =
      stableMentors.length > 0 ? 'success' : 'empty';

    if (stableMentors.length === 0 && stableIds.size === 0) {
      session.dataSnapshot = EMPTY_READY_LIST_SNAPSHOT;
      session.listSnapshot = EMPTY_READY_LIST_SNAPSHOT;
      return !Object.is(prevListSnapshot, session.listSnapshot);
    }

    if (
      session.dataSnapshot &&
      Object.is(session.dataSnapshot.mentors, stableMentors) &&
      Object.is(session.dataSnapshot.mentorIds, stableIds) &&
      session.dataSnapshot.listStatus === nextListStatus
    ) {
      session.listSnapshot = session.dataSnapshot;
      return !Object.is(prevListSnapshot, session.listSnapshot);
    }

    const readySnapshot: FavoriteMentorsSnapshot = Object.freeze({
      mentors: stableMentors,
      mentorIds: stableIds,
      listStatus: nextListStatus,
      isLoading: false,
      isStoreReadyForUser: true,
      error: null,
    });
    session.dataSnapshot = readySnapshot;
    session.listSnapshot = readySnapshot;
    return true;
  }

  function notifyListListeners(): void {
    Array.from(listListeners).forEach((entry) => {
      if (listListeners.has(entry)) {
        entry.onChange(getListSnapshot(entry.userId));
      }
    });
  }

  function notifyMentorListeners(mentorIds: Iterable<number>): void {
    Array.from(mentorIds).forEach((mentorId) => {
      const listeners = mentorListeners.get(mentorId);
      if (!listeners) return;
      Array.from(listeners).forEach((listener) => {
        if (listeners.has(listener)) {
          listener();
        }
      });
    });
  }

  function notifyAllMentorListeners(): void {
    Array.from(mentorListeners.values()).forEach((listeners) => {
      Array.from(listeners).forEach((listener) => {
        if (listeners.has(listener)) {
          listener();
        }
      });
    });
  }

  function cancelSessionFetch(session: ActiveUserSession): void {
    if (session.fetchController) {
      const controller = session.fetchController;
      session.fetchController = null;
      session.fetchPromise = null;
      session.controllers.delete(controller);
      controller.abort();
    }
  }

  function teardownActiveSession(): void {
    const prev = activeSession;
    if (!prev) return;
    activeSession = null;

    Array.from(prev.controllers).forEach((controller) => {
      controller.abort();
    });
    prev.controllers.clear();
    prev.fetchController = null;
    prev.fetchPromise = null;
    prev.pendingIds.clear();
    prev.optimistic.clear();
    prev.settledBeforeLoad.clear();
    prev.confirmedIdOnly.clear();
    prev.inflightReplays.clear();
    prev.mentors = EMPTY_MENTORS;
    prev.effectiveMentorIds = EMPTY_MENTOR_IDS;
    prev.effectiveMentors = EMPTY_MENTORS;
    prev.dataSnapshot = undefined;

    notifyListListeners();
    notifyAllMentorListeners();
  }

  function ensureActiveSession(userId: string): ActiveUserSession {
    if (activeSession && activeSession.userId === userId) {
      return activeSession;
    }
    if (activeSession) {
      teardownActiveSession();
    }
    const created = createSession(userId);
    activeSession = created;
    return created;
  }

  function fetchSessionMentors(
    session: ActiveUserSession,
    opts: { force: boolean }
  ): Promise<'loaded' | 'error' | 'aborted'> {
    if (!opts.force) {
      if (session.status === 'ready') {
        return Promise.resolve('loaded');
      }
      if (session.fetchPromise) {
        return session.fetchPromise;
      }
    } else {
      cancelSessionFetch(session);
    }

    if (session.status !== 'ready') {
      session.status = 'loading';
      session.error = null;
      if (syncSessionSnapshots(session)) {
        notifyListListeners();
      }
    }

    const controller = new AbortController();
    session.controllers.add(controller);
    session.fetchController = controller;

    const promise = (async (): Promise<'loaded' | 'error' | 'aborted'> => {
      try {
        const fetched = await transport.fetchFavoriteMentors(
          session.userId,
          controller.signal
        );
        session.controllers.delete(controller);
        if (session.fetchController === controller) {
          session.fetchController = null;
          session.fetchPromise = null;
        }
        if (controller.signal.aborted || activeSession !== session) {
          return 'aborted';
        }

        const prevIds = session.effectiveMentorIds;
        const deduped: MentorType[] = [];
        const seen = new Set<number>();
        fetched.forEach((mentor) => {
          if (isValidMentorId(mentor.user_id) && !seen.has(mentor.user_id)) {
            seen.add(mentor.user_id);
            deduped.push(mentor);
            session.confirmedIdOnly.delete(mentor.user_id);
          }
        });

        let mergedServer = deduped;
        let needsPostLoadRefresh = false;
        if (session.settledBeforeLoad.size > 0) {
          Array.from(session.settledBeforeLoad.entries()).forEach(
            ([mentorId, settled]) => {
              if (settled.favorited) {
                if (settled.snapshot) {
                  session.confirmedIdOnly.delete(mentorId);
                  mergedServer = [
                    settled.snapshot,
                    ...mergedServer.filter((m) => m.user_id !== mentorId),
                  ];
                } else if (!mergedServer.some((m) => m.user_id === mentorId)) {
                  session.confirmedIdOnly.add(mentorId);
                  needsPostLoadRefresh = true;
                }
              } else {
                session.confirmedIdOnly.delete(mentorId);
                mergedServer = mergedServer.filter(
                  (m) => m.user_id !== mentorId
                );
              }
            }
          );
          session.settledBeforeLoad.clear();
        }

        Array.from(session.optimistic.keys()).forEach((mentorId) => {
          if (!session.pendingIds.has(mentorId)) {
            session.optimistic.delete(mentorId);
          }
        });

        session.mentors = mergedServer.length > 0 ? mergedServer : EMPTY_MENTORS;
        session.status = 'ready';
        session.error = null;

        const listChanged = syncSessionSnapshots(session);
        const nextIds = session.effectiveMentorIds;
        const changedIds = new Set<number>();
        prevIds.forEach((id) => {
          if (!nextIds.has(id)) changedIds.add(id);
        });
        nextIds.forEach((id) => {
          if (!prevIds.has(id)) changedIds.add(id);
        });

        if (listChanged) {
          notifyListListeners();
        }
        if (changedIds.size > 0) {
          notifyMentorListeners(changedIds);
        }
        if (needsPostLoadRefresh) {
          void fetchSessionMentors(session, { force: true });
        }

        return 'loaded';
      } catch (err) {
        session.controllers.delete(controller);
        if (session.fetchController === controller) {
          session.fetchController = null;
          session.fetchPromise = null;
        }
        if (controller.signal.aborted || activeSession !== session) {
          return 'aborted';
        }

        if (session.status !== 'ready') {
          session.status = 'error';
          session.error = err instanceof Error ? err : new Error(String(err));
          if (syncSessionSnapshots(session)) {
            notifyListListeners();
          }
        }
        return 'error';
      }
    })();

    if (!controller.signal.aborted) {
      session.fetchPromise = promise;
    }
    return promise;
  }

  function subscribe(
    rawUserId: string,
    onChange: (snapshot: FavoriteMentorsSnapshot) => void,
    opts?: { force?: boolean }
  ): () => void {
    if (!isFavoritesEnabled()) {
      return NOOP_UNSUBSCRIBE;
    }
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
      return NOOP_UNSUBSCRIBE;
    }

    const hadUserListSubscribers = Array.from(listListeners).some(
      (item) => item.userId === userId
    );
    const entry: ListSubscriberEntry = { userId, onChange };
    listListeners.add(entry);

    const session = ensureActiveSession(userId);
    if (
      opts?.force ||
      session.status === 'idle' ||
      (session.status === 'error' && !hadUserListSubscribers)
    ) {
      void fetchSessionMentors(session, { force: Boolean(opts?.force) });
    }

    return () => {
      listListeners.delete(entry);
    };
  }

  function subscribeMentorState(
    rawUserId: string | null,
    mentorId: number,
    onChange: () => void
  ): () => void {
    if (!isFavoritesEnabled()) {
      return NOOP_UNSUBSCRIBE;
    }
    const userId = normalizeUserId(rawUserId);
    if (!userId || !isValidMentorId(mentorId) || userId === String(mentorId)) {
      return NOOP_UNSUBSCRIBE;
    }

    let listeners = mentorListeners.get(mentorId);
    if (!listeners) {
      listeners = new Set();
      mentorListeners.set(mentorId, listeners);
    }
    listeners.add(onChange);

    const session = ensureActiveSession(userId);
    if (session.status === 'idle') {
      void fetchSessionMentors(session, { force: false });
    }

    return () => {
      const currentListeners = mentorListeners.get(mentorId);
      if (currentListeners) {
        currentListeners.delete(onChange);
        if (currentListeners.size === 0) {
          mentorListeners.delete(mentorId);
        }
      }
    };
  }

  function getMentorState(
    rawUserId: string | null,
    mentorId: number
  ): MentorBookmarkState {
    if (!isFavoritesEnabled()) {
      return selectMentorStateSingleton(false, false, false);
    }
    const userId = normalizeUserId(rawUserId);
    if (!userId || !isValidMentorId(mentorId)) {
      return selectMentorStateSingleton(false, false, false);
    }
    if (userId === String(mentorId)) {
      return selectMentorStateSingleton(false, false, true);
    }
    if (!activeSession || activeSession.userId !== userId) {
      return selectMentorStateSingleton(false, false, false);
    }
    return selectMentorStateSingleton(
      activeSession.effectiveMentorIds.has(mentorId),
      activeSession.pendingIds.has(mentorId),
      false
    );
  }

  function getListSnapshot(rawUserId: string | null): FavoriteMentorsSnapshot {
    if (!isFavoritesEnabled()) {
      return DISABLED_LIST_SNAPSHOT;
    }
    const userId = normalizeUserId(rawUserId);
    if (!userId || !activeSession || activeSession.userId !== userId) {
      return LOADING_LIST_SNAPSHOT;
    }
    return activeSession.listSnapshot;
  }

  async function toggle(params: {
    userId: string | null;
    mentorId: number;
    mentorSnapshot?: MentorType;
    feature: FavoriteMentorFeature;
  }): Promise<BookmarkActionOutcome> {
    if (!isFavoritesEnabled()) {
      return { status: 'noop', nextFavorited: false };
    }
    const { mentorId, mentorSnapshot, feature } = params;
    if (!isValidMentorId(mentorId)) {
      return { status: 'noop', nextFavorited: false };
    }

    const userId = normalizeUserId(params.userId);
    if (!userId) {
      storage.savePending(mentorId, now());
      trackAnalytics({
        name: 'auth_gate_triggered',
        feature: 'favorites',
        metadata: {
          gate_feature: 'favorites',
          trigger_type: 'click_cta',
          mentor_id: mentorId,
        },
      });
      return {
        status: 'guest_redirect',
        signInUrl: getSignInUrl(`/profile/${mentorId}`),
        nextFavorited: false,
      };
    }

    if (userId === String(mentorId)) {
      return { status: 'self_blocked', nextFavorited: false };
    }

    const session = ensureActiveSession(userId);
    if (session.status === 'idle') {
      void fetchSessionMentors(session, { force: false });
    }

    const currentlyFavorited = session.effectiveMentorIds.has(mentorId);
    if (session.pendingIds.has(mentorId)) {
      return { status: 'skipped', nextFavorited: currentlyFavorited };
    }

    const nextFavorited = !currentlyFavorited;
    const action = nextFavorited ? 'add' : 'remove';
    const normalizedSnapshot =
      mentorSnapshot && mentorSnapshot.user_id === mentorId
        ? mentorSnapshot
        : undefined;

    session.pendingIds.add(mentorId);
    session.optimistic.set(mentorId, {
      favorited: nextFavorited,
      snapshot: normalizedSnapshot,
    });
    if (syncSessionSnapshots(session)) {
      notifyListListeners();
    }
    notifyMentorListeners([mentorId]);

    const controller = new AbortController();
    session.controllers.add(controller);

    try {
      if (nextFavorited) {
        await transport.addFavoriteMentor(userId, mentorId, controller.signal);
      } else {
        await transport.removeFavoriteMentor(
          userId,
          mentorId,
          controller.signal
        );
      }

      session.controllers.delete(controller);
      if (controller.signal.aborted || activeSession !== session) {
        return { status: 'aborted', nextFavorited: false };
      }

      session.pendingIds.delete(mentorId);
      session.optimistic.delete(mentorId);

      if (session.status !== 'ready') {
        session.settledBeforeLoad.set(mentorId, {
          favorited: nextFavorited,
          snapshot: normalizedSnapshot,
        });
      }

      let needsBackgroundRefresh = false;
      if (nextFavorited) {
        if (normalizedSnapshot) {
          session.confirmedIdOnly.delete(mentorId);
          const filtered = session.mentors.filter(
            (m) => m.user_id !== mentorId
          );
          session.mentors = [normalizedSnapshot, ...filtered];
        } else {
          const alreadyHasCard = session.mentors.some(
            (m) => m.user_id === mentorId
          );
          if (!alreadyHasCard) {
            session.confirmedIdOnly.add(mentorId);
            needsBackgroundRefresh = session.status === 'ready';
          }
        }
      } else {
        session.confirmedIdOnly.delete(mentorId);
        const filtered = session.mentors.filter((m) => m.user_id !== mentorId);
        session.mentors = filtered.length > 0 ? filtered : EMPTY_MENTORS;
      }

      if (syncSessionSnapshots(session)) {
        notifyListListeners();
      }
      if (needsBackgroundRefresh) {
        void fetchSessionMentors(session, { force: true });
      }
      notifyMentorListeners([mentorId]);

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
      session.controllers.delete(controller);
      if (controller.signal.aborted || activeSession !== session) {
        return { status: 'aborted', nextFavorited: false };
      }

      session.pendingIds.delete(mentorId);
      session.optimistic.delete(mentorId);
      if (syncSessionSnapshots(session)) {
        notifyListListeners();
      }
      notifyMentorListeners([mentorId]);

      return {
        status: 'failed',
        nextFavorited: session.effectiveMentorIds.has(mentorId),
        error,
      };
    }
  }

  async function replayPendingForPage(params: {
    userId: string;
    pageMentorId: number;
    mentor: { isMentor: boolean; snapshot?: MentorType } | null;
  }): Promise<BookmarkActionOutcome> {
    if (!isFavoritesEnabled()) {
      storage.clearPending();
      return { status: 'noop', nextFavorited: false };
    }

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

    if (!mentor) {
      return {
        status: 'noop',
        nextFavorited: getMentorState(userId, pageMentorId).isFavorited,
      };
    }

    if (!mentor.isMentor) {
      storage.clearPending();
      return { status: 'non_mentor', nextFavorited: false };
    }

    const session = ensureActiveSession(userId);
    const existingReplay = session.inflightReplays.get(pageMentorId);
    if (existingReplay) {
      return existingReplay;
    }

    const replayPromise = (async (): Promise<BookmarkActionOutcome> => {
      if (session.status !== 'ready') {
        const fetchResult = await fetchSessionMentors(session, {
          force: false,
        });
        if (fetchResult === 'aborted' || activeSession !== session) {
          return { status: 'aborted', nextFavorited: false };
        }
      }

      if (session.effectiveMentorIds.has(pageMentorId)) {
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
      if (session.inflightReplays.get(pageMentorId) === replayPromise) {
        session.inflightReplays.delete(pageMentorId);
      }
    });

    session.inflightReplays.set(pageMentorId, replayPromise);
    return replayPromise;
  }

  async function retry(rawUserId: string): Promise<void> {
    if (!isFavoritesEnabled()) return;
    const userId = normalizeUserId(rawUserId);
    if (!userId) return;
    const session = ensureActiveSession(userId);
    await fetchSessionMentors(session, { force: true });
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
    if (!isFavoritesEnabled()) {
      return;
    }
    const session = ensureActiveSession(userId);
    cancelSessionFetch(session);
    session.pendingIds.clear();
    session.optimistic.clear();
    session.settledBeforeLoad.clear();
    session.confirmedIdOnly.clear();
    session.error = null;

    const fullMentors: MentorType[] = [];
    const seen = new Set<number>();
    mentors.forEach((entry) => {
      if (typeof entry === 'number') {
        if (isValidMentorId(entry) && !seen.has(entry)) {
          session.confirmedIdOnly.add(entry);
        }
      } else if (isValidMentorId(entry.user_id) && !seen.has(entry.user_id)) {
        seen.add(entry.user_id);
        session.confirmedIdOnly.delete(entry.user_id);
        fullMentors.push(entry);
      }
    });

    session.mentors = fullMentors.length > 0 ? fullMentors : EMPTY_MENTORS;
    session.status = 'ready';
    syncSessionSnapshots(session);
    notifyListListeners();
    notifyAllMentorListeners();
  }

  function setTransport(next?: Partial<FavoriteMentorsTransport>): void {
    transport = {
      ...defaultTransport,
      ...next,
    };
  }

  function getSnapshot(rawUserId: string): FavoriteMentorsSnapshot | undefined {
    if (!isFavoritesEnabled()) return undefined;
    const userId = normalizeUserId(rawUserId);
    if (!userId || !activeSession || activeSession.userId !== userId) {
      return undefined;
    }
    return activeSession.dataSnapshot;
  }

  function clear(): void {
    teardownActiveSession();
    storage.clearPending();
  }

  return {
    subscribe,
    subscribeMentorState,
    getMentorState,
    getListSnapshot,
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
