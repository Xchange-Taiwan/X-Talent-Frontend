import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromAny } from '@total-typescript/shoehorn';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
      putUnwrapped: vi.fn(),
    },
  };
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

import { apiClient, ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  createInMemoryNotificationSource,
  getNotificationContent,
  getNotificationHref,
  httpNotificationSource,
  mapNotificationVOToItem,
  type NotificationItem,
  notificationReadModel,
  type NotificationSource,
  notificationStoreManager,
  projectNotificationCenterView,
  projectNotificationItem,
  resetNotificationStore,
  resolveNotificationUserId,
} from '@/lib/notifications';
import type { components } from '@/types/api';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CURRENT_DIR, '../../..');

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'test-id',
    type: 'reservation_requested',
    createdAt: '2026-01-01T00:00:00.000Z',
    unread: false,
    ...overrides,
  };
}

const SAMPLE_ITEMS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'reservation_requested',
    menteeName: '小明',
    createdAt: '2026-01-01T00:00:00.000Z',
    unread: true,
  },
  {
    id: 'n2',
    type: 'reservation_success',
    mentorName: '林導師',
    createdAt: '2026-01-01T00:01:00.000Z',
    unread: true,
  },
  {
    id: 'n3',
    type: 'reservation_failed',
    mentorName: '王導師',
    createdAt: '2026-01-01T00:02:00.000Z',
    unread: false,
  },
];

describe('notificationReadModel deep module & architectural boundaries (#925)', () => {
  it('removes legacy src/stores, src/services/notifications, Header/notificationUtils.ts, and production fixture helpers', () => {
    expect(existsSync(resolve(REPO_ROOT, 'src/stores'))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, 'src/services/notifications'))).toBe(
      false
    );
    expect(
      existsSync(
        resolve(REPO_ROOT, 'src/components/layout/Header/notificationUtils.ts')
      )
    ).toBe(false);

    const modelSource = readFileSync(
      resolve(CURRENT_DIR, 'notificationReadModel.ts'),
      'utf8'
    );
    expect(modelSource).not.toContain('createFixtureNotificationSource');
    expect(modelSource).not.toContain('FIXTURE_RETRY_DELAY_MS');
    expect(modelSource).toContain('singleFlight');

    const categoryGroupingSource = readFileSync(
      resolve(REPO_ROOT, 'src/lib/profile/categoryGrouping.ts'),
      'utf8'
    );
    expect(categoryGroupingSource).toContain("from '@/types/category'");
    expect(categoryGroupingSource).not.toContain('@/components/');
  });

  it('enforces ESLint no-restricted-imports across src/lib/**, src/services/**, and src/schemas/** while exempting .test.ts', async () => {
    interface LintMessage {
      ruleId: string | null;
    }
    interface LintResult {
      messages: LintMessage[];
    }
    interface ESLintInstance {
      lintText(
        code: string,
        options?: { filePath?: string }
      ): Promise<LintResult[]>;
    }
    const require = createRequire(import.meta.url);
    const { ESLint } = require('eslint') as {
      ESLint: new (options: {
        cwd: string;
        overrideConfigFile: string;
        useEslintrc: boolean;
      }) => ESLintInstance;
    };

    const eslint = new ESLint({
      cwd: REPO_ROOT,
      overrideConfigFile: resolve(REPO_ROOT, '.eslintrc.js'),
      useEslintrc: false,
    });

    const forbiddenImports = [
      "import * as React from 'react';",
      "import { usePathname } from 'next/navigation';",
      "import { useSession } from 'next-auth/react';",
      "import { useFoo } from '@/hooks/useFoo';",
      "import { Foo } from '@/components/ui/foo';",
      "import { store } from '@/stores/foo';",
      "import Page from '@/app/page';",
    ];
    const targetFiles = [
      resolve(REPO_ROOT, 'src/lib/sampleBoundaryCheck.ts'),
      resolve(REPO_ROOT, 'src/services/sampleBoundaryCheck.ts'),
      resolve(REPO_ROOT, 'src/schemas/sampleBoundaryCheck.ts'),
    ];

    const snippet = `${forbiddenImports.join('\n')}\nexport const x = 1;\n`;

    for (const filePath of targetFiles) {
      const [result] = await eslint.lintText(snippet, { filePath });
      const restrictedErrors = result.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports'
      );
      expect(
        restrictedErrors,
        `Expected all 7 forbidden imports to fail in ${filePath}`
      ).toHaveLength(forbiddenImports.length);
    }

    const [testFileResult] = await eslint.lintText(snippet, {
      filePath: resolve(REPO_ROOT, 'src/lib/sampleBoundaryCheck.test.ts'),
    });
    expect(
      testFileResult.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports'
      )
    ).toHaveLength(0);
  });
});

describe('httpNotificationSource & createInMemoryNotificationSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.*Unwrapped directly in httpNotificationSource without intermediate service wrappers', async () => {
    vi.mocked(apiClient.getUnwrapped)
      .mockResolvedValueOnce({ unread_count: 5 })
      .mockResolvedValueOnce({
        notifications: [
          {
            id: 1,
            type: 'reservation_requested',
            metadata: { role: 'mentor', counterparty_name: 'Alice' },
            created_at: 1700000000,
            read_at: null,
          },
        ],
        next_cursor: 'cursor-20',
      })
      .mockResolvedValueOnce(null);
    vi.mocked(apiClient.putUnwrapped)
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ updated_count: 5 });

    expect(httpNotificationSource.requiresAuth).toBe(true);
    expect(httpNotificationSource.isPreloaded).toBe(false);
    expect(httpNotificationSource.retry).toBeUndefined();

    const unreadRes = await httpNotificationSource.getUnreadCount('123');
    expect(unreadRes).toEqual({ unread_count: 5 });
    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/users/123/notifications/unread-count'
    );

    const listRes = await httpNotificationSource.listNotifications(
      '123',
      'cursor-0',
      20
    );
    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/users/123/notifications',
      {
        params: {
          cursor: 'cursor-0',
          batch: 20,
        },
      }
    );
    expect(listRes.next_cursor).toBe('cursor-20');
    expect(listRes.notifications).toHaveLength(1);
    expect(listRes.notifications[0]).toMatchObject({
      id: '1',
      type: 'reservation_requested',
      menteeName: 'Alice',
      unread: true,
      title: '您有新的預約',
      body: 'Alice 與您提出預約需求，請前往接受預約',
      targetHref: '/reservation/mentor?tab=pending',
    });

    const emptyRes = await httpNotificationSource.listNotifications(
      '123',
      null,
      20
    );
    expect(emptyRes).toEqual({ notifications: [], next_cursor: null });

    await httpNotificationSource.markOneRead('123', '99');
    expect(apiClient.putUnwrapped).toHaveBeenCalledWith(
      '/v1/users/123/notifications/99'
    );

    await httpNotificationSource.markAllRead('123');
    expect(apiClient.putUnwrapped).toHaveBeenCalledWith(
      '/v1/users/123/notifications/read-all'
    );
  });

  it('propagates ApiError from httpNotificationSource operations', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(400, 'Failed count')
    );
    await expect(httpNotificationSource.getUnreadCount('123')).rejects.toThrow(
      ApiError
    );

    vi.mocked(apiClient.putUnwrapped).mockRejectedValueOnce(
      new ApiError(500, 'Failed mark read')
    );
    await expect(
      httpNotificationSource.markOneRead('123', '99')
    ).rejects.toThrow(ApiError);
  });

  it('supports cursor pagination, isolated mutations, requiresAuth, isPreloaded, and unreadCountOverride in createInMemoryNotificationSource', async () => {
    const seed = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      type: 'reservation_requested' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      unread: i < 3,
    }));
    const source = createInMemoryNotificationSource(seed);

    expect(source.requiresAuth).toBe(true);
    expect(source.isPreloaded).toBe(false);
    expect(source.retry).toBeUndefined();
    expect(await source.getUnreadCount('u1')).toEqual({ unread_count: 3 });

    const page1 = await source.listNotifications('u1', undefined, 2);
    expect(page1.notifications.map((n) => n.id)).toEqual(['1', '2']);
    expect(page1.next_cursor).toBe('2');

    const page2 = await source.listNotifications('u1', '2', 2);
    expect(page2.notifications.map((n) => n.id)).toEqual(['3', '4']);
    expect(page2.next_cursor).toBe('4');

    const page3 = await source.listNotifications('u1', '4', 2);
    expect(page3.notifications.map((n) => n.id)).toEqual(['5']);
    expect(page3.next_cursor).toBeNull();

    await source.markOneRead('u1', '1');
    expect(await source.getUnreadCount('u1')).toEqual({ unread_count: 2 });
    expect(seed[0].unread).toBe(true);

    await source.markAllRead('u1');
    expect(await source.getUnreadCount('u1')).toEqual({ unread_count: 0 });

    const customOptionsSource = createInMemoryNotificationSource([], {
      requiresAuth: false,
      isPreloaded: true,
      unreadCountOverride: 12,
    });
    expect(customOptionsSource.requiresAuth).toBe(false);
    expect(customOptionsSource.isPreloaded).toBe(true);
    expect(await customOptionsSource.getUnreadCount('generic')).toEqual({
      unread_count: 12,
    });
  });
});

describe('mapNotificationVOToItem & domain projection (title, body, targetHref)', () => {
  const baseApiItem: components['schemas']['NotificationVO'] = {
    id: 1,
    type: 'reservation_requested',
    metadata: { role: 'mentor', counterparty_name: 'Alice' },
    created_at: 0,
    read_at: null,
  };

  it('normalizes seconds vs milliseconds timestamps, null metadata, invalid created_at, and read_at', () => {
    const secondsTimestamp = 1700000000;
    expect(
      mapNotificationVOToItem({ ...baseApiItem, created_at: secondsTimestamp })
        .createdAt
    ).toBe(new Date(secondsTimestamp * 1000).toISOString());

    const msTimestamp = 1700000000000;
    expect(
      mapNotificationVOToItem({ ...baseApiItem, created_at: msTimestamp })
        .createdAt
    ).toBe(new Date(msTimestamp).toISOString());

    const nullMetaItem = mapNotificationVOToItem({
      ...baseApiItem,
      metadata: null as unknown as Record<string, unknown>,
    });
    expect(nullMetaItem.role).toBeUndefined();
    expect(nullMetaItem.unread).toBe(true);
    expect(nullMetaItem.title).toBe('您有新的預約');

    for (const invalidCreatedAt of [
      undefined,
      null,
      NaN,
    ] as unknown as number[]) {
      const item = mapNotificationVOToItem({
        ...baseApiItem,
        created_at: invalidCreatedAt,
      });
      expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
    }

    expect(
      mapNotificationVOToItem({ ...baseApiItem, read_at: 1700000000 }).unread
    ).toBe(false);
  });

  it('maps role, counterparty_name, actor_role, dtstart, dtend, and official feedback types (#733, #734, #875, #906)', () => {
    const upcomingItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_upcoming',
      metadata: {
        role: 'mentee',
        actor_role: 'system',
        counterparty_name: 'Mentor C',
        dtstart: 1755000000,
        dtend: 1755001800,
      },
    });
    const formattedUpcoming = dayjs.unix(1755000000).format('YYYY/MM/DD HH:mm');
    expect(upcomingItem).toMatchObject({
      actorRole: 'system',
      dtstart: 1755000000,
      dtend: 1755001800,
      mentorName: 'Mentor C',
      title: '您與 Mentor C 的預約即將到來',
      body: `您與 Mentor C 的會議即將在 ${formattedUpcoming} 開始，請準時上線`,
      targetHref: '/reservation/mentee?tab=upcoming',
    });

    const mentorAttendanceReq = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_attendance_requested',
      metadata: {
        role: fromAny('MENTOR'),
        counterparty_name: '林學員',
        reservation_id: 205,
      },
    });
    expect(mentorAttendanceReq).toMatchObject({
      category: 'attendance_requested',
      role: 'mentor',
      menteeName: '林學員',
      reservationId: '205',
      title: '留下您的會談紀錄',
      body: '您與 林學員 的會談已結束，前往留下紀錄。',
      targetHref: '/reservation/mentor?tab=history&reservationId=205',
    });

    for (const reminderType of [
      'feedback_reminder',
      'reservation_feedback_reminder',
      'meeting_feedback_reminder',
    ] as const) {
      const omittedRoleMentee = mapNotificationVOToItem({
        ...baseApiItem,
        type: reminderType,
        metadata: { counterparty_name: 'Emily Chen', reservation_id: ' 301 ' },
      });
      expect(omittedRoleMentee).toMatchObject({
        role: 'mentee',
        mentorName: 'Emily Chen',
        reservationId: '301',
        title: '留下您的會談回饋',
        targetHref: '/reservation/mentee?tab=history&reservationId=301',
      });

      const omittedRoleMentor = mapNotificationVOToItem({
        ...baseApiItem,
        type: reminderType,
        metadata: { mentee_name: '林學員', reservation_id: 302 },
      });
      expect(omittedRoleMentor).toMatchObject({
        role: 'mentor',
        menteeName: '林學員',
        reservationId: '302',
        title: '留下您的會談紀錄',
        targetHref: '/reservation/mentor?tab=history&reservationId=302',
      });
    }

    const inferredFeedbackReceived = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'meeting_feedback_received',
      metadata: { mentee_name: ' 王小明 ', reserve_id: 408 },
    });
    expect(inferredFeedbackReceived).toMatchObject({
      role: 'mentor',
      menteeName: '王小明',
      reservationId: '408',
      title: '您收到新的回饋',
      body: '王小明 為您留下了一則會談回饋，前往查看。',
      targetHref: '/reservation/mentor?tab=history&reservationId=408',
    });
  });

  describe.each([
    {
      type: 'reservation_requested' as const,
      role: undefined,
      menteeName: '小明',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=pending',
      expectedTitle: '您有新的預約',
    },
    {
      type: 'reservation_success' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '林導師',
      expectedHref: '/reservation/mentee?tab=upcoming',
      expectedTitle: '林導師 已接受您的預約',
    },
    {
      type: 'reservation_failed' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '王導師',
      expectedHref: '/mentor-pool',
      expectedTitle: '您與 王導師 的預約已被拒絕',
    },
    {
      type: 'reservation_canceled' as const,
      role: 'mentor' as const,
      menteeName: '小明',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=history',
      expectedTitle: '您與 小明 的預約已被取消',
    },
    {
      type: 'reservation_canceled' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '陳導師',
      expectedHref: '/mentor-pool',
      expectedTitle: '您與 陳導師 的預約已被取消',
    },
    {
      type: 'reservation_upcoming' as const,
      role: undefined,
      menteeName: '小華',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=upcoming',
      expectedTitle: '您與 小華 的預約即將到來',
    },
  ])(
    'projects $type (role=$role, menteeName=$menteeName)',
    ({ type, role, menteeName, mentorName, expectedHref, expectedTitle }) => {
      it(`resolves ${expectedTitle} -> ${expectedHref}`, () => {
        const projected = projectNotificationItem(
          buildItem({ type, role, menteeName, mentorName })
        );
        expect(projected.title).toBe(expectedTitle);
        expect(projected.targetHref).toBe(expectedHref);
      });
    }
  );

  it('distinguishes system vs manual reservation_canceled copy and falls back safely for unknown types (#858)', () => {
    expect(
      getNotificationContent(
        buildItem({
          type: 'reservation_canceled',
          role: 'mentee',
          actorRole: 'system',
          mentorName: '陳導師',
        })
      )
    ).toEqual({
      title: '您與 陳導師 的預約已自動取消',
      body: '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約，歡迎重新預約',
    });

    expect(
      getNotificationContent(
        buildItem({
          type: 'reservation_canceled',
          role: 'mentor',
          actorRole: 'system',
          menteeName: '小明',
        })
      )
    ).toEqual({
      title: '您與 小明 的預約已自動取消',
      body: '因您未於預約開始前 24 小時前確認，系統已自動取消此預約',
    });

    expect(
      getNotificationContent(
        buildItem({
          type: 'reservation_canceled',
          role: 'mentor',
          actorRole: 'mentee',
          menteeName: '小明',
        })
      ).body
    ).toBe('學員已取消此次預約，點擊查看預約紀錄');

    const unknown = projectNotificationItem(
      buildItem({
        type: 'future_unknown' as NotificationItem['type'],
      })
    );
    expect(unknown.title).toBe('通知');
    expect(unknown.body).toBe('您有一則新通知');
    expect(unknown.targetHref).toBe('/');
    expect(
      getNotificationHref(
        buildItem({
          type: 'feedback_reminder',
          targetHref: '/reservation/mentor?tab=history&reservationId=777',
        })
      )
    ).toBe('/reservation/mentor?tab=history&reservationId=777');
  });
});

describe('notificationReadModel state lifecycle, singleFlight, & compatibility exports', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(captureFlowFailure).mockClear();
    resetNotificationStore();
  });

  it('exposes notificationStoreManager as an alias to notificationReadModel and resets state via resetNotificationStore', async () => {
    expect(notificationStoreManager).toBe(notificationReadModel);

    const source = createInMemoryNotificationSource(SAMPLE_ITEMS);
    const countSpy = vi.spyOn(source, 'getUnreadCount');

    notificationReadModel.configure('user-1', { source });
    await vi.waitFor(() => {
      expect(
        notificationReadModel.getOrCreateState('user-1').unreadCountState
      ).toBe(2);
    });
    expect(countSpy).toHaveBeenCalledTimes(1);

    resetNotificationStore();
    expect(notificationReadModel.getSource('user-1')).toBeUndefined();
    expect(
      notificationReadModel.getOrCreateState('user-1').unreadCountState
    ).toBe(0);
  });

  it('coalesces concurrent loadUnreadCount and loadInitialData calls via singleFlight and cleans up after failure', async () => {
    const deferredCount = createDeferred<{ unread_count: number }>();
    const deferredList = createDeferred<{
      notifications: NotificationItem[];
      next_cursor: string | null;
    }>();

    const source: NotificationSource = {
      requiresAuth: false,
      isPreloaded: false,
      getUnreadCount: vi.fn(() => deferredCount.promise),
      listNotifications: vi.fn(() => deferredList.promise),
      markOneRead: async () => {},
      markAllRead: async () => {},
    };
    notificationReadModel.setSource('u-flight', source);

    const c1 = notificationReadModel.loadUnreadCount('u-flight');
    const c2 = notificationReadModel.loadUnreadCount('u-flight');
    expect(c1).toBe(c2);
    expect(source.getUnreadCount).toHaveBeenCalledTimes(1);

    deferredCount.resolve({ unread_count: 4 });
    await Promise.all([c1, c2]);
    expect(
      notificationReadModel.getOrCreateState('u-flight').unreadCountState
    ).toBe(4);

    vi.mocked(source.getUnreadCount).mockResolvedValue({ unread_count: 2 });
    const l1 = notificationReadModel.loadInitialData('u-flight', true);
    const l2 = notificationReadModel.loadInitialData('u-flight', true);
    expect(l1).toBe(l2);
    expect(source.listNotifications).toHaveBeenCalledTimes(1);

    deferredList.resolve({ notifications: SAMPLE_ITEMS, next_cursor: '20' });
    await Promise.all([l1, l2]);

    const state = notificationReadModel.getOrCreateState('u-flight');
    expect(state.notifications).toHaveLength(3);
    expect(state.notifications[0]?.title).toBe('您有新的預約');
    expect(state.notifications[0]?.targetHref).toBe(
      '/reservation/mentor?tab=pending'
    );

    const view = projectNotificationCenterView(state, true);
    expect(view).toMatchObject({
      badgeCount: 2,
      hasUnread: true,
      formattedCount: '2',
      hasMore: true,
      olderUnreadCount: 0,
      showBadge: true,
    });
  });

  it('clamps seenUnreadCount only when settled and rolls back optimistic markRead / markAllRead on failure', async () => {
    localStorage.setItem('notif_seen_unread_count_user-clamp', '7');

    notificationReadModel.configure('user-clamp', {
      initialNotifications: [],
      initialStatus: 'loading',
    });
    expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
      '7'
    );

    notificationReadModel.configure('user-clamp', {
      initialNotifications: SAMPLE_ITEMS,
      initialStatus: 'success',
    });
    expect(
      notificationReadModel.getOrCreateState('user-clamp').seenUnreadCount
    ).toBe(2);

    const deferredMarkAll = createDeferred<void>();
    notificationReadModel.setSource('user-clamp', {
      requiresAuth: false,
      isPreloaded: false,
      getUnreadCount: async () => ({ unread_count: 2 }),
      listNotifications: async () => ({
        notifications: SAMPLE_ITEMS,
        next_cursor: null,
      }),
      markOneRead: async () => {},
      markAllRead: () => deferredMarkAll.promise,
    });

    const p = notificationReadModel.markAllRead('user-clamp');
    expect(
      notificationReadModel.getOrCreateState('user-clamp').unreadCountState
    ).toBe(0);
    expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
      '2'
    );

    deferredMarkAll.reject(new Error('network fail'));
    expect((await p).status).toBe('failed');
    expect(
      notificationReadModel.getOrCreateState('user-clamp').unreadCountState
    ).toBe(2);
    expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
      '2'
    );
  });

  it('resolves effective userId with onboarding and route suppression unless an explicit source/fixture is injected', () => {
    expect(
      resolveNotificationUserId({
        userId: 'u-1',
        enabled: true,
        pathname: '/auth/onboarding',
        isIncompleteOnboarding: false,
        hasExplicitSource: false,
      })
    ).toBeUndefined();

    expect(
      resolveNotificationUserId({
        userId: 'u-1',
        enabled: true,
        pathname: '/mentor-pool',
        isIncompleteOnboarding: true,
        hasExplicitSource: false,
      })
    ).toBeUndefined();

    expect(
      resolveNotificationUserId({
        userId: 'u-1',
        enabled: true,
        pathname: '/auth/onboarding',
        isIncompleteOnboarding: true,
        hasExplicitSource: true,
      })
    ).toBe('u-1');

    expect(
      resolveNotificationUserId({
        userId: 'u-1',
        enabled: false,
        pathname: '/mentor-pool',
        isIncompleteOnboarding: false,
        hasExplicitSource: true,
      })
    ).toBeUndefined();
  });
});
