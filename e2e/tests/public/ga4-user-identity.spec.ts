import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { blockUnmockedExternalApi, mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

interface NormalizedGaEvent {
  name: string;
  params: Record<string, unknown>;
}

interface NormalizedUserSyncRecord {
  command: 'config' | 'set';
  target: string | null;
  params: Record<string, unknown>;
}

const USER_ID = '999998';
const PRE_UNLOAD_DATALAYER_KEY = '__e2e_ga4_pre_unload_datalayer';

const MOCK_INTERESTS = {
  code: '0',
  msg: 'ok',
  data: { interests: [], language: 'zh_TW' },
};

const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    catalogs: {
      skill: {
        groups: [
          {
            subject_group: 'SKILL_GROUP',
            subject: '技術能力',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'FRONTEND',
                subject: '前端開發',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      topic: { groups: [] },
      position: { groups: [] },
      industry: { groups: [] },
    },
  },
};

const MOCK_MENTORS_RESPONSE = {
  code: '0',
  msg: 'ok',
  data: {
    mentors: [
      {
        user_id: 7482008160728084,
        name: '王小明',
        avatar: '',
        job_title: 'Senior Frontend Engineer',
        company: 'XChange',
        years_of_experience: 'THREE_TO_FIVE_YEARS',
        location: 'TWN',
        linkedin_profile: '',
        interested_positions: [],
        skills: ['FRONTEND'],
        topics: [],
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: ['FRONTEND'],
        have_topic: [],
        industry: 'Technology',
        language: 'zh_TW',
        personal_statement: '專注於大型前端架構與職涯發展分享。',
        about: '專注於大型前端架構與職涯發展分享。',
        seniority_level: 'SENIOR',
        expertises: [],
        experiences: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ],
    next_id: 0,
    next_cursor: null,
  },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRawDataLayer(rawEntries: unknown[]): {
  events: NormalizedGaEvent[];
  userSyncs: NormalizedUserSyncRecord[];
} {
  const events: NormalizedGaEvent[] = [];
  const userSyncs: NormalizedUserSyncRecord[] = [];

  for (const item of rawEntries) {
    if (Array.isArray(item)) {
      if (item[0] === 'event' && typeof item[1] === 'string') {
        events.push({
          name: item[1],
          params: isPlainRecord(item[2]) ? item[2] : {},
        });
      } else if (
        item[0] === 'config' &&
        typeof item[1] === 'string' &&
        isPlainRecord(item[2]) &&
        ('user_id' in item[2] || 'user_role' in item[2])
      ) {
        userSyncs.push({
          command: 'config',
          target: item[1],
          params: item[2],
        });
      } else if (item[0] === 'set' && isPlainRecord(item[1])) {
        userSyncs.push({
          command: 'set',
          target: null,
          params: item[1],
        });
      }
    } else if (isPlainRecord(item) && typeof item.event === 'string') {
      const { event, ...rest } = item;
      events.push({
        name: event,
        params: rest,
      });
    }
  }

  return { events, userSyncs };
}

async function readPageDataLayer(page: Page): Promise<{
  rawEntries: unknown[];
  events: NormalizedGaEvent[];
  userSyncs: NormalizedUserSyncRecord[];
}> {
  const rawEntries = await page.evaluate(() => {
    function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
      return (
        typeof val === 'object' &&
        val !== null &&
        '0' in val &&
        'length' in val &&
        typeof val.length === 'number'
      );
    }

    const layer = window.dataLayer ?? [];
    return layer.map((entry) => {
      if (Array.isArray(entry)) {
        return entry;
      }
      if (isArrayLikeEntry(entry)) {
        return Array.from(entry);
      }
      return entry;
    });
  });

  return {
    rawEntries,
    ...parseRawDataLayer(rawEntries),
  };
}

async function mockGoogleCallbackServerAction(
  page: Page,
  mockPayload: Record<string, unknown>
): Promise<void> {
  await page.route(/\/auth\/google\/callback\/redirect/, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.headers()['next-action']) {
      const upstream = await route.fetch();
      const bodyText = await upstream.text();
      const patchedLines = bodyText
        .split(/\r?\n/)
        .map((line) =>
          /^1:(?:E)?\{/.test(line) ? `1:${JSON.stringify(mockPayload)}` : line
        );
      return route.fulfill({
        status: 200,
        headers: upstream.headers(),
        body: patchedLines.join(String.fromCharCode(10)),
      });
    }
    return route.continue();
  });
}

test.describe('GA4 會員身分識別 user_id、user_role 與 login/sign_up 認證事件收斂 (#866)', () => {
  test.beforeEach(async ({ page }) => {
    await blockUnmockedExternalApi(page);
    await page.route('https://www.googletagmanager.com/**', (route) =>
      route.fulfill({
        status: 204,
        contentType: 'application/javascript',
        body: '',
      })
    );
    await page.route('https://www.clarity.ms/**', (route) =>
      route.fulfill({
        status: 204,
        contentType: 'application/javascript',
        body: '',
      })
    );
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
    await mockApiRoute(page, /\/v1\/users\/zh_TW\/interests/, {
      body: MOCK_INTERESTS,
    });
    await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
      body: MOCK_TAG_CATALOG,
    });
    await mockApiRoute(page, /\/v1\/mentors/, {
      body: MOCK_MENTORS_RESPONSE,
    });
    await mockApiRoute(page, /\/v1\/me\/favorite-mentors(\?|$)/, {
      body: { code: '0', msg: 'ok', data: { mentors: [] } },
    });
  });

  test('驗證登入狀態綁定內部 user_id 與 user_role 並附帶於事件、嚴格阻擋個資，且登出時以 null 清除', async ({
    page,
  }) => {
    await page.addInitScript((storageKey: string) => {
      function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
        return (
          typeof val === 'object' &&
          val !== null &&
          '0' in val &&
          'length' in val &&
          typeof val.length === 'number'
        );
      }

      window.addEventListener('pagehide', () => {
        try {
          const layer = window.dataLayer ?? [];
          const normalized = layer.map((entry) => {
            if (Array.isArray(entry)) return entry;
            if (isArrayLikeEntry(entry)) {
              return Array.from(entry);
            }
            return entry;
          });
          window.sessionStorage.setItem(storageKey, JSON.stringify(normalized));
        } catch {
          // Ignore storage quota or security errors during unload
        }
      });
    }, PRE_UNLOAD_DATALAYER_KEY);

    await setSignedSessionCookie(page, {
      id: USER_ID,
      name: 'Alice Chen',
      onBoarding: true,
      isMentor: true,
      jobTitle: 'Staff Engineer',
      company: 'XChange',
      token: 'mock-secret-access-token',
    });

    await page.route(/\/api\/auth\/backend-logout/, async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.continue();
    });

    await page.goto('/mentor-pool');
    await expect(
      page.locator('a[data-analytics-click="mentor_card"]').first()
    ).toBeVisible({ timeout: 15_000 });

    // 1. 驗證 AnalyticsUserSync 已將內部 user_id 與 user_role='mentor' 同步至 GA4 config / set，且首筆進站 page_view 已附帶 user_id 與 user_role
    await expect
      .poll(async () => {
        const { userSyncs } = await readPageDataLayer(page);
        return userSyncs.find((record) => record.params.user_id === USER_ID);
      })
      .toMatchObject({
        params: {
          user_id: USER_ID,
          user_role: 'mentor',
        },
      });

    await expect
      .poll(async () => {
        const { events } = await readPageDataLayer(page);
        return events.find(
          (e) => e.name === 'page_view' && e.params.page_path === '/mentor-pool'
        );
      })
      .toMatchObject({
        name: 'page_view',
        params: {
          page_path: '/mentor-pool',
          user_id: USER_ID,
          user_role: 'mentor',
        },
      });

    // 2. 觸發篩選標籤互動事件，驗證後續 GA4 事件皆自動附帶 user_id 與 user_role
    const firstChip = page
      .locator('[data-analytics-click="mentor_pool_popular_chip"]')
      .first();
    await expect(firstChip).toBeVisible();
    await firstChip.click();

    await expect
      .poll(async () => {
        const { events } = await readPageDataLayer(page);
        return events.find((e) => e.name === 'mentor_pool_filter_apply');
      })
      .toMatchObject({
        name: 'mentor_pool_filter_apply',
        params: {
          feature: 'mentor_pool',
          user_id: USER_ID,
          user_role: 'mentor',
        },
      });

    // 3. 點開右上角會員選單，確認選單已展開顯示「登出」並驗證整份 dataLayer 零個資外洩，擷取 UI 證據截圖
    const menuTrigger = page.getByRole('button', { name: '開啟用戶選單' });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    const logoutMenuItem = page.getByRole('menuitem', { name: '登出' });
    await expect(logoutMenuItem).toBeVisible();

    const { rawEntries: loggedInRawEntries } = await readPageDataLayer(page);
    const serializedLoggedIn = JSON.stringify(loggedInRawEntries);
    expect(serializedLoggedIn).not.toContain('Alice Chen');
    expect(serializedLoggedIn).not.toContain('mock-secret-access-token');
    expect(serializedLoggedIn).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

    await captureEvidence(page, 'ga4-user-id-bound-account-menu');

    // 4. 點擊「登出」：驗證跳轉前與登出後皆以 user_id: null、user_role: 'guest' 清除 GA4 User-ID
    await logoutMenuItem.click();

    await expect(menuTrigger).toBeHidden({ timeout: 15_000 });
    const signInHeaderLink = page
      .getByTestId('desktop-header-right')
      .getByRole('link', { name: '登入' });
    await expect(signInHeaderLink).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies();
          return cookies.some(
            (c) =>
              c.name === 'next-auth.session-token' ||
              c.name === '__Secure-next-auth.session-token'
          );
        },
        { timeout: 15_000 }
      )
      .toBe(false);

    // 驗證登出當下（卸載前）已立即送出 user_id: null 清除指令
    const preUnloadEntries = await page.evaluate((storageKey: string) => {
      const saved = window.sessionStorage.getItem(storageKey);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }, PRE_UNLOAD_DATALAYER_KEY);

    if (preUnloadEntries.length > 0) {
      const { userSyncs: preUnloadSyncs } = parseRawDataLayer(preUnloadEntries);
      expect(
        preUnloadSyncs.some(
          (record) =>
            record.params.user_id === null &&
            record.params.user_role === 'guest'
        )
      ).toBe(true);
    }

    // 驗證登出後訪客頁面同步設定 user_id: null 與 user_role: 'guest'
    await expect
      .poll(async () => {
        const { userSyncs } = await readPageDataLayer(page);
        return userSyncs.some(
          (record) =>
            record.params.user_id === null &&
            record.params.user_role === 'guest'
        );
      })
      .toBe(true);

    // 登出後以訪客身分點擊 Header 導覽至 /about，確認事件為 user_role: 'guest' 且絕不殘留舊 user_id
    const aboutNavLink = page
      .getByRole('link', { name: '關於 X-Talent' })
      .first();
    await expect(aboutNavLink).toBeVisible();
    await aboutNavLink.click();

    await expect(page).toHaveURL('/about');
    await expect(
      page.getByRole('heading', { level: 1, name: /關於\s*X-Talent/ })
    ).toBeVisible();

    await expect
      .poll(async () => {
        const { events } = await readPageDataLayer(page);
        return events.find(
          (e) =>
            e.name === 'button_click' &&
            e.params.button_id === 'header_nav_about'
        );
      })
      .toMatchObject({
        name: 'button_click',
        params: {
          button_id: 'header_nav_about',
          user_role: 'guest',
        },
      });

    const { events: guestEvents } = await readPageDataLayer(page);
    const guestAboutClick = guestEvents.find(
      (e) =>
        e.name === 'button_click' && e.params.button_id === 'header_nav_about'
    );
    expect(guestAboutClick?.params.user_id).toBeUndefined();

    await captureEvidence(page, 'ga4-user-id-cleared-after-logout');
  });

  test('驗證 Email 註冊收斂為 sign_up (method: Email) 與 Google OAuth 登入收斂為 login (method: Google)', async ({
    page,
  }) => {
    // 1. Email 註冊收斂為 sign_up (method: 'Email', user_role: 'guest')，且不洩漏註冊 Email 與密碼
    await mockApiRoute(page, /\/v1\/auth\/signup/, {
      body: { code: '0', msg: 'ok' },
    });

    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', 'new-mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.fill('input[name="confirm_password"]', 'Password1234');
    await page.getByRole('checkbox').click();
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/auth/email-verify', { timeout: 15_000 });

    await expect
      .poll(async () => {
        const { events } = await readPageDataLayer(page);
        return events.find((e) => e.name === 'sign_up');
      })
      .toMatchObject({
        name: 'sign_up',
        params: {
          feature: 'auth',
          method: 'Email',
          user_role: 'guest',
        },
      });

    const { rawEntries: afterSignUpRaw } = await readPageDataLayer(page);
    const serializedSignUp = JSON.stringify(afterSignUpRaw);
    expect(serializedSignUp).not.toContain('new-mentee@example.com');
    expect(serializedSignUp).not.toContain('Password1234');

    // 2. Google OAuth 登入收斂為 login (method: 'Google', user_id: '889', user_role: 'mentee')
    await mockGoogleCallbackServerAction(page, {
      code: '0',
      msg: 'ok',
      data: {
        auth_type: 'LOGIN',
        auth: {
          email: 'oauth-mentee@example.com',
          user_id: 889,
          token: 'mock-google-jwt-token-889',
        },
        user: {
          user_id: 889,
          name: 'OAuth Mentee Real Name',
          avatar: '',
          is_mentor: false,
          onboarding: true,
          job_title: 'Product Manager',
          company: 'XChange',
          experiences: [],
        },
      },
    });

    await page.goto(
      '/auth/google/callback/redirect?code=mock-login-889&state=mock-state'
    );
    await expect(page).toHaveURL('/mentor-pool', { timeout: 15_000 });

    await expect
      .poll(async () => {
        const { events } = await readPageDataLayer(page);
        return events.find((e) => e.name === 'login');
      })
      .toMatchObject({
        name: 'login',
        params: {
          feature: 'auth',
          method: 'Google',
          user_id: '889',
          user_role: 'mentee',
        },
      });

    const { rawEntries: afterGoogleLoginRaw } = await readPageDataLayer(page);
    const serializedGoogleLogin = JSON.stringify(afterGoogleLoginRaw);
    expect(serializedGoogleLogin).not.toContain('oauth-mentee@example.com');
    expect(serializedGoogleLogin).not.toContain('OAuth Mentee Real Name');
    expect(serializedGoogleLogin).not.toContain('mock-google-jwt-token-889');
    expect(serializedGoogleLogin).not.toContain('mock-login-889');
  });
});
