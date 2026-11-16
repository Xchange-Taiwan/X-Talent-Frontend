import type { Page, Route } from '@playwright/test';
import type { Session } from 'next-auth';
import { encode, type JWT } from 'next-auth/jwt';

import type { PersonalLink } from '@/types/types';

export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  // Forward-compatible Auth.js / NextAuth v5 session cookie names
  'authjs.session-token',
  '__Secure-authjs.session-token',
] as const;

const AUTH_RELATED_COOKIE_NAMES = new Set<string>([
  ...NEXTAUTH_SESSION_COOKIE_NAMES,
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'session-hint',
]);

const DEFAULT_EXPIRES = '2099-01-01T00:00:00.000Z';
const DEFAULT_ACCESS_TOKEN = 'mock-access-token';
const AUTH_SESSION_ROUTE_RE = /\/api\/auth\/session(\?|$)/;

export interface SessionPayload {
  id: string;
  name: string;
  onBoarding: boolean;
  isMentor: boolean;
  /** Becomes session.accessToken via auth.config.ts session callback */
  token: string;
  email?: string;
  avatar?: string | null;
  avatarUpdatedAt?: number;
  jobTitle?: string;
  company?: string;
  personalLinks?: PersonalLink[];
  msg?: string;
  provider?: string;
  error?: 'RefreshTokenError';
}

export interface MockSessionUserOptions {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string | null;
  avatarUpdatedAt?: number;
  onBoarding?: boolean;
  isMentor?: boolean;
  /** Becomes session.accessToken via auth.config.ts session callback */
  token?: string;
  /** Alias for `token` when migrating CSR session fixtures */
  accessToken?: string;
  jobTitle?: string;
  company?: string;
  personalLinks?: PersonalLink[];
  msg?: string;
  provider?: string;
  error?: 'RefreshTokenError';
  expires?: string;
}

export interface MockAuthSessionHandle {
  session: Session;
  getSession: () => Session;
  clear: () => Promise<void>;
}

export interface MaintenanceOverridePayload {
  maintenanceMode: boolean;
  bypassToken?: string;
}

interface InternalSessionController {
  active: boolean;
  currentSession: Session;
  routeHandler: (route: Route) => Promise<void>;
}

const pageSessionControllers = new WeakMap<Page, InternalSessionController>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Derive cookie domain, secure flag, and cookie *name* from BASE_URL so the
// same helper works against both http://localhost:3000 and remote https
// deployments. NextAuth prefixes the cookie name with `__Secure-` when the
// deployment serves over HTTPS — forging without this prefix means the server
// never sees the cookie and treats the user as signed-out.
function getCookieTarget(): {
  name: string;
  domain: string;
  secure: boolean;
} {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  const url = new URL(baseUrl);
  const secure = url.protocol === 'https:';
  return {
    name: secure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
    domain: url.hostname,
    secure,
  };
}

/**
 * Isolated JWE encoding boundary around `next-auth/jwt` `encode()`.
 * Centralizes secret resolution and token formatting so future NextAuth /
 * Auth.js upgrades (e.g. cookie-name salt derivation) only touch one place.
 */
async function encodeNextAuthToken(tokenPayload: JWT): Promise<string> {
  return encode({
    token: tokenPayload,
    secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  });
}

function normalizePayloadOptions(options: MockSessionUserOptions = {}): {
  jwtPayload: SessionPayload;
  expires: string;
} {
  const resolvedToken =
    options.accessToken ?? options.token ?? DEFAULT_ACCESS_TOKEN;

  const jwtPayload: SessionPayload = {
    id: options.id ?? '1',
    name: options.name ?? 'Test User',
    onBoarding: options.onBoarding ?? true,
    isMentor: options.isMentor ?? false,
    token: resolvedToken,
    avatar: options.avatar ?? '',
    jobTitle: options.jobTitle ?? '',
    company: options.company ?? '',
    personalLinks: options.personalLinks ?? [],
    ...(options.email !== undefined ? { email: options.email } : {}),
    ...(options.avatarUpdatedAt !== undefined
      ? { avatarUpdatedAt: options.avatarUpdatedAt }
      : {}),
    ...(options.msg !== undefined ? { msg: options.msg } : {}),
    ...(options.provider !== undefined ? { provider: options.provider } : {}),
    ...(options.error !== undefined ? { error: options.error } : {}),
  };

  return {
    jwtPayload,
    expires: options.expires ?? DEFAULT_EXPIRES,
  };
}

/**
 * Builds a client `Session` object matching `src/auth.config.ts`'s
 * `sessionCallback` contract 1:1.
 */
export function buildMockSession(
  options: MockSessionUserOptions = {}
): Session {
  const { jwtPayload, expires } = normalizePayloadOptions(options);

  const session: Session = {
    user: {
      id: jwtPayload.id,
      name: jwtPayload.name,
      avatar: jwtPayload.avatar ?? undefined,
      avatarUpdatedAt: jwtPayload.avatarUpdatedAt,
      onBoarding: jwtPayload.onBoarding,
      isMentor: jwtPayload.isMentor,
      jobTitle: jwtPayload.jobTitle,
      company: jwtPayload.company,
      personalLinks: jwtPayload.personalLinks ?? [],
      msg: jwtPayload.msg,
      provider: jwtPayload.provider,
      email: jwtPayload.email,
    },
    accessToken: jwtPayload.token,
    expires,
    ...(jwtPayload.error !== undefined ? { error: jwtPayload.error } : {}),
  };

  return session;
}

function sessionToJwtPayload(session: Session): SessionPayload {
  const user = session.user ?? {};
  return {
    id: user.id ?? '1',
    name: user.name ?? 'Test User',
    onBoarding: user.onBoarding ?? true,
    isMentor: user.isMentor ?? false,
    token: session.accessToken ?? DEFAULT_ACCESS_TOKEN,
    avatar: user.avatar ?? '',
    jobTitle: user.jobTitle ?? '',
    company: user.company ?? '',
    personalLinks: user.personalLinks ?? [],
    ...(user.email ? { email: user.email } : {}),
    ...(user.avatarUpdatedAt !== undefined
      ? { avatarUpdatedAt: user.avatarUpdatedAt }
      : {}),
    ...(user.msg !== undefined ? { msg: user.msg } : {}),
    ...(user.provider !== undefined ? { provider: user.provider } : {}),
    ...(session.error !== undefined ? { error: session.error } : {}),
  };
}

function mergeSessionPatch(currentSession: Session, rawBody: unknown): Session {
  // NextAuth v4 client wraps `useSession().update(arg)` inside `{ csrfToken, data: arg }`,
  // while custom test callers may post `{ user: ... }` directly at top level.
  const unwrapped =
    isRecord(rawBody) && isRecord(rawBody.data) ? rawBody.data : rawBody;
  if (!isRecord(unwrapped)) {
    return currentSession;
  }

  const nextUser = isRecord(unwrapped.user)
    ? { ...currentSession.user, ...unwrapped.user }
    : { ...currentSession.user };

  const nextSession: Session = {
    ...currentSession,
    user: nextUser,
    ...(typeof unwrapped.accessToken === 'string'
      ? { accessToken: unwrapped.accessToken }
      : {}),
    ...(unwrapped.error === 'RefreshTokenError'
      ? { error: 'RefreshTokenError' }
      : {}),
  };

  return nextSession;
}

async function hasActiveSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) =>
    NEXTAUTH_SESSION_COOKIE_NAMES.some((name) => cookie.name === name)
  );
}

async function ensureSessionRouteController(
  page: Page,
  initialSession: Session,
  active: boolean
): Promise<InternalSessionController> {
  const existing = pageSessionControllers.get(page);
  if (existing) {
    existing.currentSession = initialSession;
    existing.active = active;
    return existing;
  }

  const controller: InternalSessionController = {
    active,
    currentSession: initialSession,
    routeHandler: async (route: Route) => {
      const method = route.request().method();

      if (method === 'GET') {
        if (!controller.active || !(await hasActiveSessionCookie(page))) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(controller.currentSession),
        });
        return;
      }

      if ((method === 'POST' || method === 'PUT') && controller.active) {
        let parsedBody: unknown;
        try {
          parsedBody = route.request().postDataJSON();
        } catch {
          parsedBody = undefined;
        }
        controller.currentSession = mergeSessionPatch(
          controller.currentSession,
          parsedBody
        );
        await setSignedSessionCookie(
          page,
          sessionToJwtPayload(controller.currentSession)
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(controller.currentSession),
        });
        return;
      }

      await route.continue();
    },
  };

  pageSessionControllers.set(page, controller);
  await page.route(AUTH_SESSION_ROUTE_RE, controller.routeHandler);
  return controller;
}

/**
 * Forge a properly signed next-auth.session-token cookie so that
 * getSession() / getServerSession() return a real decoded session —
 * without hitting the real backend.
 *
 * The secret must match the running server's NEXTAUTH_SECRET. Defaults to
 * 'secret' (matches .env.development.local). When BASE_URL targets a remote
 * deployment, set NEXTAUTH_SECRET to that deployment's secret or the cookie
 * will fail to decrypt and the user will appear signed-out.
 */
export async function setSignedSessionCookie(
  page: Page,
  payload: SessionPayload
): Promise<void> {
  const jwtToken: JWT = { ...payload };
  const signed = await encodeNextAuthToken(jwtToken);

  const { name, domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name,
      value: signed,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Deep E2E session fixture owning BOTH:
 * 1. SSR NextAuth signed JWE cookie (`next-auth.session-token` / `__Secure-...`)
 *    verified by Next.js `src/middleware.ts` and RSC `getServerSession()`.
 * 2. Stateful CSR `/api/auth/session` route mocking (`GET` + `POST`/`PUT`
 *    mutations from `useSession().update(...)`), keeping the JWE cookie and
 *    client session payload synchronized and automatically returning `{}` if
 *    the session cookie is cleared via `signOut()` or `clearMockAuthSession()`.
 */
export async function seedMockAuthSession(
  page: Page,
  userOptions: MockSessionUserOptions = {}
): Promise<MockAuthSessionHandle> {
  const { jwtPayload } = normalizePayloadOptions(userOptions);
  const initialSession = buildMockSession(userOptions);

  await setSignedSessionCookie(page, jwtPayload);
  const controller = await ensureSessionRouteController(
    page,
    initialSession,
    true
  );

  return {
    session: controller.currentSession,
    getSession: () => controller.currentSession,
    clear: () => clearMockAuthSession(page),
  };
}

/**
 * Clears any mocked NextAuth session state and strips NextAuth session +
 * `session-hint` cookies (while preserving unrelated cookies such as
 * `__e2e_maintenance`) so tests can transition cleanly to a signed-out guest
 * state or isolate multi-step auth flows.
 */
export async function clearMockAuthSession(page: Page): Promise<void> {
  const existingCookies = await page.context().cookies();
  const nonAuthCookies = existingCookies.filter(
    (cookie) => !AUTH_RELATED_COOKIE_NAMES.has(cookie.name)
  );

  await page.context().clearCookies();
  if (nonAuthCookies.length > 0) {
    await page.context().addCookies(nonAuthCookies);
  }

  await ensureSessionRouteController(page, buildMockSession(), false);
}

/**
 * Forge a signed `__e2e_maintenance` cookie verified by `src/middleware.ts`
 * via `NEXTAUTH_SECRET` so an isolated Playwright context can exercise
 * maintenance mode and bypass-token flows without toggling global config.
 */
export async function setSignedMaintenanceCookie(
  page: Page,
  payload: MaintenanceOverridePayload
): Promise<void> {
  const jwtToken: JWT = {
    maintenanceMode: payload.maintenanceMode,
    ...(payload.bypassToken !== undefined
      ? { bypassToken: payload.bypassToken }
      : {}),
  };
  const signed = await encodeNextAuthToken(jwtToken);

  const { domain, secure } = getCookieTarget();
  await page.context().addCookies([
    {
      name: '__e2e_maintenance',
      value: signed,
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
    },
  ]);
}
