// @vitest-environment node
import { decode } from 'next-auth/jwt';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildMockSession,
  clearMockAuthSession,
  seedMockAuthSession,
  setSignedMaintenanceCookie,
} from '../e2e/helpers/session.ts';

function createFakePlaywrightPage() {
  let cookieJar = [];
  const routes = [];

  const context = {
    async cookies() {
      return [...cookieJar];
    },
    async addCookies(newCookies) {
      for (const next of newCookies) {
        cookieJar = cookieJar.filter((c) => c.name !== next.name);
        cookieJar.push({ ...next });
      }
    },
    async clearCookies() {
      cookieJar = [];
    },
  };

  const page = {
    context: () => context,
    async route(matcher, handler) {
      routes.push({ matcher, handler });
    },
    getRegisteredRouteCount() {
      return routes.length;
    },
    async dispatchSessionRequest(method = 'GET', jsonBody = undefined) {
      const matched = routes.find(({ matcher }) =>
        matcher.test('http://localhost:3000/api/auth/session')
      );
      if (!matched) {
        throw new Error('No /api/auth/session route registered');
      }

      let fulfilled = null;
      let continued = false;
      const routeObj = {
        request: () => ({
          method: () => method,
          postDataJSON: () => jsonBody,
        }),
        fulfill: async (res) => {
          fulfilled = {
            status: res.status,
            contentType: res.contentType,
            json: JSON.parse(res.body),
          };
        },
        continue: async () => {
          continued = true;
        },
      };

      await matched.handler(routeObj);
      return { fulfilled, continued };
    },
  };

  return page;
}

describe('e2e/helpers/session.ts (seedMockAuthSession & clearMockAuthSession)', () => {
  const originalBaseUrl = process.env.BASE_URL;
  const originalSecret = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = originalBaseUrl;
    }
    if (originalSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalSecret;
    }
  });

  it('seeds a valid NextAuth JWE cookie and matching CSR /api/auth/session response', async () => {
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.NEXTAUTH_SECRET = 'unit-test-secret';

    const page = createFakePlaywrightPage();
    const handle = await seedMockAuthSession(page, {
      id: '42',
      name: 'Alice Mentor',
      email: 'alice@example.com',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Staff Engineer',
      company: 'XChange',
      token: 'custom-jwt-token',
    });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === 'next-auth.session-token'
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie.secure).toBe(false);

    const decoded = await decode({
      token: sessionCookie.value,
      secret: 'unit-test-secret',
    });
    expect(decoded).toMatchObject({
      id: '42',
      name: 'Alice Mentor',
      email: 'alice@example.com',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Staff Engineer',
      company: 'XChange',
      token: 'custom-jwt-token',
    });

    const { fulfilled } = await page.dispatchSessionRequest('GET');
    expect(fulfilled.status).toBe(200);
    expect(fulfilled.json).toEqual(handle.session);
    expect(fulfilled.json).toMatchObject({
      user: {
        id: '42',
        name: 'Alice Mentor',
        email: 'alice@example.com',
        isMentor: true,
        onBoarding: true,
        jobTitle: 'Staff Engineer',
        company: 'XChange',
        personalLinks: [],
      },
      accessToken: 'custom-jwt-token',
      expires: '2099-01-01T00:00:00.000Z',
    });
  });

  it('uses __Secure-next-auth.session-token when BASE_URL is HTTPS', async () => {
    process.env.BASE_URL = 'https://staging.xtalent.tw';
    process.env.NEXTAUTH_SECRET = 'https-secret';

    const page = createFakePlaywrightPage();
    await seedMockAuthSession(page, { id: '7', name: 'Staging User' });

    const cookies = await page.context().cookies();
    const secureCookie = cookies.find(
      (c) => c.name === '__Secure-next-auth.session-token'
    );
    expect(secureCookie).toBeDefined();
    expect(secureCookie.secure).toBe(true);
    expect(secureCookie.domain).toBe('staging.xtalent.tw');
  });

  it('synchronizes stateful POST/PUT /api/auth/session updates across CSR session and SSR JWE cookie', async () => {
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.NEXTAUTH_SECRET = 'sync-secret';

    const page = createFakePlaywrightPage();
    await seedMockAuthSession(page, {
      id: '1',
      name: 'Onboarding Mentee',
      onBoarding: false,
      isMentor: false,
    });

    // Simulate NextAuth v4 client `useSession().update({ user: { ... } })` wire format `{ csrfToken, data }`
    const postRes = await page.dispatchSessionRequest('POST', {
      csrfToken: 'csrf-123',
      data: {
        user: {
          name: 'Graduated Mentor',
          onBoarding: true,
          isMentor: true,
        },
      },
    });
    expect(postRes.fulfilled.json.user).toMatchObject({
      id: '1',
      name: 'Graduated Mentor',
      onBoarding: true,
      isMentor: true,
    });

    // Subsequent GET returns updated session
    const getRes = await page.dispatchSessionRequest('GET');
    expect(getRes.fulfilled.json.user).toMatchObject({
      name: 'Graduated Mentor',
      onBoarding: true,
      isMentor: true,
    });

    // SSR JWE cookie was also re-signed with updated claims so middleware sees onBoarding=true & isMentor=true
    const [cookie] = await page.context().cookies();
    const decoded = await decode({
      token: cookie.value,
      secret: 'sync-secret',
    });
    expect(decoded).toMatchObject({
      name: 'Graduated Mentor',
      onBoarding: true,
      isMentor: true,
    });
  });

  it('isolates state via clearMockAuthSession while preserving non-auth cookies and avoiding duplicate route handlers', async () => {
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.NEXTAUTH_SECRET = 'isolation-secret';

    const page = createFakePlaywrightPage();
    await setSignedMaintenanceCookie(page, {
      maintenanceMode: true,
      bypassToken: 'qa-token',
    });
    await page.context().addCookies([
      {
        name: 'session-hint',
        value: '1|99',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await seedMockAuthSession(page, { id: '99', name: 'First User' });
    expect(page.getRegisteredRouteCount()).toBe(1);

    await clearMockAuthSession(page);
    const remainingCookies = await page.context().cookies();
    expect(remainingCookies.map((c) => c.name)).toEqual(['__e2e_maintenance']);

    const loggedOutGet = await page.dispatchSessionRequest('GET');
    expect(loggedOutGet.fulfilled.json).toEqual({});

    // Re-seeding on the same page reuses the single controller instead of stacking routes
    await seedMockAuthSession(page, {
      id: '100',
      name: 'Second User',
      isMentor: true,
    });
    expect(page.getRegisteredRouteCount()).toBe(1);

    const reseededGet = await page.dispatchSessionRequest('GET');
    expect(reseededGet.fulfilled.json).toEqual(
      buildMockSession({ id: '100', name: 'Second User', isMentor: true })
    );
  });
});
