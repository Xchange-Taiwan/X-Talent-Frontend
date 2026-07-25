// Mints a ready-to-inject NextAuth session cookie for a QA account instead
// of driving the real sign-in form through Playwright.
//
// Role model (see src/middleware.ts and src/auth.config.ts): the app only
// distinguishes "logged in or not" and `isMentor`, giving exactly three
// roles — visitor (no cookie), mentee (isMentor:false), mentor
// (isMentor:true).
//
// Two credential sources, selected by the caller's `useRealBackend` flag
// (qa-bridge.mjs sets this from QA_USE_REAL_BACKEND — see
// scripts/ai-qa/README.md), not by env-var presence alone: leftover
// QA_TEST_ACCOUNT_* values in .env.development.local from a previous
// real-backend run must not silently get sent to the mock server, which
// doesn't check passwords and would just resolve to the wrong role for an
// email it doesn't recognize.
//  - useRealBackend:true → logs in with QA_TEST_ACCOUNT_*_EMAIL/_PASSWORD
//    against whatever `apiBaseUrl` the caller passes.
//  - useRealBackend:false (the default) → logs in with fixed sentinel
//    emails that only mean something to the QA mock server
//    (mock-api-server.mjs). No real account setup required.
// Either way this is one real, non-UI login call (a plain fetch, not a
// browser-driven form submission — still avoids the flakiness/timing cost
// of the actual sign-in page), then signs a NextAuth-shaped JWT from the
// response the same way auth.config.ts's own callbacks would.
import { encode } from 'next-auth/jwt';

import {
  MENTEE_SENTINEL_EMAIL,
  MENTOR_SENTINEL_EMAIL,
} from './mock-api-server.mjs';

export class AuthFixtureError extends Error {}

const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour — comfortably longer than a QA run

// Local dev always runs over http (see .env.example's NEXTAUTH_URL), so
// NextAuth uses the unprefixed cookie name — the `__Secure-` prefix only
// applies once useSecureCookies (https) kicks in.
export const SESSION_COOKIE_NAME = 'next-auth.session-token';

function credentialsFor(role, useRealBackend) {
  if (!useRealBackend) {
    // Mock server doesn't check passwords — only which sentinel email decides the role.
    return {
      email: role === 'mentor' ? MENTOR_SENTINEL_EMAIL : MENTEE_SENTINEL_EMAIL,
      password: 'mock-password',
    };
  }

  const prefix =
    role === 'mentor' ? 'QA_TEST_ACCOUNT_MENTOR' : 'QA_TEST_ACCOUNT_MENTEE';
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new AuthFixtureError(
      `QA_USE_REAL_BACKEND is set but ${prefix}_EMAIL / ${prefix}_PASSWORD are not — add a real ` +
        "QA test account's credentials to .env.development.local, see scripts/ai-qa/README.md."
    );
  }
  return { email, password };
}

/** Mirrors auth.config.ts's CredentialsProvider.authorize() parsing of the
 * same /v1/auth/login response, so the minted token matches a real session's shape. */
async function loginAndBuildUser({ apiBaseUrl, email, password }) {
  const res = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const response = await res.json();
  if (!res.ok || !response?.data) {
    throw new AuthFixtureError(
      `QA account login failed against ${apiBaseUrl} (${res.status}): ${JSON.stringify(response).slice(0, 300)}`
    );
  }

  const experiences = response.data.user.experiences ?? [];
  const personalLinks = experiences
    .filter((exp) => exp.category === 'LINK')
    .flatMap((exp) => exp.mentor_experiences_metadata?.data ?? [])
    .filter((l) => Boolean(l?.url));

  const setCookie = res.headers.get('set-cookie') ?? '';
  const refreshToken = setCookie.match(/refresh_token=([^;,]+)/)?.[1];

  return {
    id: String(response.data.auth.user_id),
    token: response.data.auth.token,
    refreshToken,
    email: response.data.auth.email,
    onBoarding: response.data.user.onboarding,
    isMentor: response.data.user.is_mentor,
    name: response.data.user.name,
    avatar: response.data.user.avatar,
    avatarUpdatedAt: response.data.user.avatar_updated_at ?? undefined,
    jobTitle: response.data.user.job_title ?? '',
    company: response.data.user.company ?? '',
    personalLinks,
  };
}

/**
 * Returns a Playwright-ready cookie object for the given role, or `[]` for
 * visitor (no session at all). `role` is 'visitor' | 'mentee' | 'mentor'.
 * `apiBaseUrl` is explicit (not read from process.env) so the caller
 * controls whether this hits the QA mock server or a real backend —
 * see qa-bridge.mjs. `useRealBackend` must match whichever `apiBaseUrl` was
 * passed (qa-bridge.mjs derives both from the same QA_USE_REAL_BACKEND
 * check) so credential selection never drifts from where the request
 * actually goes.
 */
export async function mintSessionCookies({
  role,
  apiBaseUrl,
  useRealBackend = false,
  domain = 'localhost',
}) {
  if (role === 'visitor') return [];

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new AuthFixtureError(
      'NEXTAUTH_SECRET is not set — cannot sign a session token.'
    );
  }

  const user = await loginAndBuildUser({
    apiBaseUrl,
    ...credentialsFor(role, useRealBackend),
  });
  // Mirrors authOptions.callbacks.jwt's first-sign-in branch (auth.config.ts):
  // `return { ...token, ...user, ...(account ? { provider: account.provider } : {}) }`.
  const tokenPayload = { ...user, provider: 'credentials' };

  const value = await encode({
    token: tokenPayload,
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return [
    {
      name: SESSION_COOKIE_NAME,
      value,
      domain,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ];
}
