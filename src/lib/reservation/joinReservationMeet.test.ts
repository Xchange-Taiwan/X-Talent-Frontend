import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  upgradeClaritySession: vi.fn(),
}));

vi.mock('@/services/reservations', () => ({
  fetchReservationMeetLink: vi.fn(),
}));

import { upgradeClaritySession } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';

import {
  ALLOWED_MEET_HOSTS,
  apiMeetLinkFetcher,
  browserExternalTabOpener,
  createInMemoryExternalTabOpener,
  createInMemoryMeetLinkFetcher,
  createReservationMeetJoiner,
  JOIN_MEET_FAILURE_COPY,
  MEET_LINK_FETCH_FAILED_CLARITY_REASON,
  parseSafeMeetUrl,
} from './joinReservationMeet';

const SAFE_MEET_URL = 'https://meet.google.com/abc-defg-hij';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(
  options: {
    blocked?: boolean;
    fetchMeetUrl?: () => Promise<string | null | undefined>;
  } = {}
) {
  const tabOpener = createInMemoryExternalTabOpener({
    blocked: options.blocked,
  });
  const meetLinkFetcher = createInMemoryMeetLinkFetcher(
    options.fetchMeetUrl ?? (async () => SAFE_MEET_URL)
  );
  const upgradeClarity = vi.fn();
  const joiner = createReservationMeetJoiner({
    tabOpener,
    meetLinkFetcher,
    upgradeClaritySession: upgradeClarity,
  });
  return { joiner, tabOpener, meetLinkFetcher, upgradeClarity };
}

describe('joinReservationMeet module boundary', () => {
  it('has zero React / Next / hooks-layer dependencies', () => {
    const source = readFileSync(
      path.join(__dirname, 'joinReservationMeet.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/from ['"]next(\/[^'"]*)?['"]/);
    expect(source).not.toMatch(/from ['"]@\/hooks/);
    expect(source).not.toMatch(/from ['"]@\/components/);
  });

  it('only allows the Google Meet video host', () => {
    expect(ALLOWED_MEET_HOSTS).toEqual(['meet.google.com']);
  });
});

describe('parseSafeMeetUrl', () => {
  it('accepts an https meet.google.com URL and returns the normalized href', () => {
    expect(parseSafeMeetUrl(SAFE_MEET_URL)).toBe(SAFE_MEET_URL);
    expect(parseSafeMeetUrl('https://MEET.google.com/abc-defg-hij')).toBe(
      SAFE_MEET_URL
    );
    expect(
      parseSafeMeetUrl('https://meet.google.com/abc-defg-hij?authuser=0')
    ).toBe('https://meet.google.com/abc-defg-hij?authuser=0');
  });

  it.each([
    ['http scheme', 'http://meet.google.com/abc-defg-hij'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['foreign host', 'https://unsafe-hijack-domain.com/some-path'],
    ['suffix-spoofed host', 'https://meet.google.com.evil.com/abc'],
    ['prefix-spoofed host', 'https://evilmeet.google.com/abc'],
    ['userinfo-spoofed host', 'https://meet.google.com@evil.com/abc'],
    ['credentials on allowed host', 'https://user:pass@meet.google.com/abc'],
    ['non-default port', 'https://meet.google.com:8443/abc'],
    [
      'allowed host only in query',
      'https://evil.com/?u=https://meet.google.com/',
    ],
    ['non-video Google host', 'https://calendar.google.com/calendar/event'],
    ['relative path', '/abc-defg-hij'],
    ['unparseable string', 'not a url'],
    ['empty string', ''],
    ['non-string', 42],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, raw) => {
    expect(parseSafeMeetUrl(raw)).toBeNull();
  });
});

describe('createReservationMeetJoiner', () => {
  it('returns unauthenticated without opening a tab, fetching, or upgrading Clarity when the user id is missing', async () => {
    for (const userId of [undefined, null, '', '   ']) {
      const { joiner, tabOpener, meetLinkFetcher, upgradeClarity } = setup();

      const result = await joiner.join({ userId, reservationId: 'res-123' });

      expect(result).toEqual({
        status: 'failed',
        reason: 'unauthenticated',
        ...JOIN_MEET_FAILURE_COPY.unauthenticated,
      });
      expect(tabOpener.tabs).toHaveLength(0);
      expect(meetLinkFetcher.calls).toHaveLength(0);
      expect(upgradeClarity).not.toHaveBeenCalled();
      expect(joiner.isPending()).toBe(false);
    }
  });

  it('opens one placeholder tab synchronously, fetches the link, and navigates the pre-opened tab on success', async () => {
    const { joiner, tabOpener, meetLinkFetcher, upgradeClarity } = setup();

    const pending = joiner.join({ userId: 'user-456', reservationId: 'res-1' });

    // The placeholder tab must be opened inside the same click task (before
    // the first await) so popup blockers keep honouring the user gesture.
    expect(tabOpener.tabs).toHaveLength(1);
    expect(tabOpener.tabs[0].url).toBe('about:blank');
    expect(joiner.isPending()).toBe(true);

    await expect(pending).resolves.toEqual({
      status: 'joined',
      target: 'new_tab',
    });
    expect(meetLinkFetcher.calls).toEqual([
      { userId: 'user-456', reservationId: 'res-1' },
    ]);
    expect(tabOpener.tabs[0]).toEqual({ url: SAFE_MEET_URL, closed: false });
    expect(tabOpener.currentWindowNavigations).toEqual([]);
    expect(upgradeClarity).not.toHaveBeenCalled();
    expect(joiner.isPending()).toBe(false);
  });

  it('rejects a rapid double click before opening a second tab (no about:blank flash)', async () => {
    const gate = deferred<string | null | undefined>();
    const { joiner, tabOpener, meetLinkFetcher, upgradeClarity } = setup({
      fetchMeetUrl: () => gate.promise,
    });

    const first = joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    const second = joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    const third = joiner.join({ userId: 'user-456', reservationId: 'res-1' });

    await expect(second).resolves.toEqual({
      status: 'skipped',
      reason: 'in_flight',
    });
    await expect(third).resolves.toEqual({
      status: 'skipped',
      reason: 'in_flight',
    });
    expect(tabOpener.tabs).toHaveLength(1);
    expect(tabOpener.tabs.every((tab) => !tab.closed)).toBe(true);
    expect(meetLinkFetcher.calls).toHaveLength(1);

    gate.resolve(SAFE_MEET_URL);
    await expect(first).resolves.toEqual({
      status: 'joined',
      target: 'new_tab',
    });
    expect(upgradeClarity).not.toHaveBeenCalled();

    // Lock is released once the in-flight join settles.
    await joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    expect(tabOpener.tabs).toHaveLength(2);
  });

  it('notifies subscribers when the pending state flips and stops after unsubscribe', async () => {
    const { joiner } = setup();
    const snapshots: boolean[] = [];
    const unsubscribe = joiner.subscribe(() => {
      snapshots.push(joiner.isPending());
    });

    await joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    expect(snapshots).toEqual([true, false]);

    unsubscribe();
    await joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    expect(snapshots).toEqual([true, false]);
  });

  it('falls back to navigating the current window when the browser blocks the popup', async () => {
    const { joiner, tabOpener, upgradeClarity } = setup({ blocked: true });

    const result = await joiner.join({
      userId: 'user-456',
      reservationId: 'res-1',
    });

    expect(result).toEqual({ status: 'joined', target: 'current_window' });
    expect(tabOpener.openAttempts).toBe(1);
    expect(tabOpener.tabs).toHaveLength(0);
    expect(tabOpener.currentWindowNavigations).toEqual([SAFE_MEET_URL]);
    expect(upgradeClarity).not.toHaveBeenCalled();
  });

  it('does not navigate the current window when the popup is blocked and the fetch fails', async () => {
    const { joiner, tabOpener, upgradeClarity } = setup({
      blocked: true,
      fetchMeetUrl: async () => {
        throw new ApiError(404, 'not found');
      },
    });

    const result = await joiner.join({
      userId: 'user-456',
      reservationId: 'res-1',
    });

    expect(result).toMatchObject({ status: 'failed', reason: 'not_found' });
    expect(tabOpener.currentWindowNavigations).toEqual([]);
    expect(upgradeClarity).toHaveBeenCalledWith(
      MEET_LINK_FETCH_FAILED_CLARITY_REASON
    );
  });

  it.each([
    'https://unsafe-hijack-domain.com/some-path',
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.com/abc',
    'javascript:alert(1)',
  ])(
    'blocks unsafe link %s, closes the placeholder tab and upgrades Clarity',
    async (unsafeUrl) => {
      const { joiner, tabOpener, upgradeClarity } = setup({
        fetchMeetUrl: async () => unsafeUrl,
      });

      const result = await joiner.join({
        userId: 'user-456',
        reservationId: 'res-1',
      });

      expect(result).toEqual({
        status: 'failed',
        reason: 'unsafe_link',
        ...JOIN_MEET_FAILURE_COPY.unsafe_link,
      });
      expect(tabOpener.tabs[0]).toEqual({ url: 'about:blank', closed: true });
      expect(tabOpener.currentWindowNavigations).toEqual([]);
      expect(upgradeClarity).toHaveBeenCalledWith('meet_link_fetch_failed');
    }
  );

  it.each([[''], [null], [undefined]])(
    'treats an empty meet_url (%s) as missing_link, closes the tab and upgrades Clarity',
    async (emptyUrl) => {
      const { joiner, tabOpener, upgradeClarity } = setup({
        fetchMeetUrl: async () => emptyUrl,
      });

      const result = await joiner.join({
        userId: 'user-456',
        reservationId: 'res-1',
      });

      expect(result).toEqual({
        status: 'failed',
        reason: 'missing_link',
        title: '找不到會議連結',
        description: '此預約尚未就緒，或會議連結不存在。',
      });
      expect(tabOpener.tabs[0].closed).toBe(true);
      expect(upgradeClarity).toHaveBeenCalledTimes(1);
      expect(upgradeClarity).toHaveBeenCalledWith('meet_link_fetch_failed');
    }
  );

  it.each([
    [
      new ApiError(404, 'not found'),
      'not_found',
      '連結尚未就緒或不存在（會議狀態需為已排程）。',
    ],
    [
      new ApiError(403, 'forbidden'),
      'forbidden',
      '您並非此預約的導師或學員，無法加入。',
    ],
    [
      new ApiError(500, 'server error'),
      'request_failed',
      '取得會議連結失敗，請稍後再試。',
    ],
    [
      new Error('unexpected'),
      'request_failed',
      '取得會議連結失敗，請稍後再試。',
    ],
    ['string rejection', 'request_failed', '取得會議連結失敗，請稍後再試。'],
  ])(
    'classifies fetch failure %s as %s, closes the tab and upgrades Clarity',
    async (error, reason, description) => {
      const { joiner, tabOpener, upgradeClarity } = setup({
        fetchMeetUrl: async () => {
          throw error;
        },
      });

      const result = await joiner.join({
        userId: 'user-456',
        reservationId: 'res-1',
      });

      expect(result).toEqual({
        status: 'failed',
        reason,
        title: '錯誤',
        description,
      });
      expect(tabOpener.tabs[0]).toEqual({ url: 'about:blank', closed: true });
      expect(upgradeClarity).toHaveBeenCalledWith('meet_link_fetch_failed');
      expect(joiner.isPending()).toBe(false);
    }
  );

  it('closes the tab and reports request_failed when navigating the pre-opened tab throws', async () => {
    const upgradeClarity = vi.fn();
    const close = vi.fn();
    const joiner = createReservationMeetJoiner({
      meetLinkFetcher: createInMemoryMeetLinkFetcher(async () => SAFE_MEET_URL),
      tabOpener: {
        openPlaceholderTab: () => ({
          navigate: () => {
            throw new Error('cross-origin');
          },
          close,
        }),
        navigateCurrentWindow: vi.fn(),
      },
      upgradeClaritySession: upgradeClarity,
    });

    const result = await joiner.join({
      userId: 'user-456',
      reservationId: 'res-1',
    });

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'request_failed',
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(upgradeClarity).toHaveBeenCalledWith('meet_link_fetch_failed');
    expect(joiner.isPending()).toBe(false);
  });

  it('releases the in-flight lock after a failure so the next click can retry', async () => {
    let attempt = 0;
    const { joiner, tabOpener } = setup({
      fetchMeetUrl: async () => {
        attempt += 1;
        if (attempt === 1) throw new ApiError(404, 'not found');
        return SAFE_MEET_URL;
      },
    });

    await joiner.join({ userId: 'user-456', reservationId: 'res-1' });
    const retry = await joiner.join({
      userId: 'user-456',
      reservationId: 'res-1',
    });

    expect(retry).toEqual({ status: 'joined', target: 'new_tab' });
    expect(tabOpener.tabs.map((tab) => tab.closed)).toEqual([true, false]);
  });

  it('wires the production fetcher and Clarity adapters by default', async () => {
    vi.mocked(fetchReservationMeetLink).mockRejectedValueOnce(
      new ApiError(403, 'forbidden')
    );
    const tabOpener = createInMemoryExternalTabOpener();
    const joiner = createReservationMeetJoiner({ tabOpener });

    const result = await joiner.join({ userId: 7, reservationId: 'res-9' });

    expect(fetchReservationMeetLink).toHaveBeenCalledWith({
      userId: 7,
      reservationId: 'res-9',
    });
    expect(result).toMatchObject({ status: 'failed', reason: 'forbidden' });
    expect(upgradeClaritySession).toHaveBeenCalledWith(
      'meet_link_fetch_failed'
    );
  });
});

describe('apiMeetLinkFetcher', () => {
  it('returns meet_url from fetchReservationMeetLink', async () => {
    vi.mocked(fetchReservationMeetLink).mockResolvedValueOnce({
      meet_url: SAFE_MEET_URL,
    });

    await expect(
      apiMeetLinkFetcher.fetchMeetUrl({
        userId: 'user-456',
        reservationId: 'res-1',
      })
    ).resolves.toBe(SAFE_MEET_URL);
    expect(fetchReservationMeetLink).toHaveBeenCalledWith({
      userId: 'user-456',
      reservationId: 'res-1',
    });
  });
});

describe('browserExternalTabOpener', () => {
  const windowOpen = vi.fn();
  const currentLocation = { href: 'https://x-talent.example/reservation' };

  beforeEach(() => {
    windowOpen.mockReset();
    currentLocation.href = 'https://x-talent.example/reservation';
    vi.stubGlobal('window', { open: windowOpen, location: currentLocation });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pre-opens about:blank in a new tab and navigates / closes that tab', () => {
    const tabLocation = { href: 'about:blank' };
    const tabClose = vi.fn();
    windowOpen.mockReturnValue({ location: tabLocation, close: tabClose });

    const handle = browserExternalTabOpener.openPlaceholderTab();

    expect(windowOpen).toHaveBeenCalledWith('about:blank', '_blank');
    handle?.navigate(SAFE_MEET_URL);
    expect(tabLocation.href).toBe(SAFE_MEET_URL);
    handle?.close();
    expect(tabClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when the popup is blocked', () => {
    windowOpen.mockReturnValue(null);
    expect(browserExternalTabOpener.openPlaceholderTab()).toBeNull();
  });

  it('navigates the current window as the popup-blocked fallback', () => {
    browserExternalTabOpener.navigateCurrentWindow(SAFE_MEET_URL);
    expect(currentLocation.href).toBe(SAFE_MEET_URL);
  });
});
