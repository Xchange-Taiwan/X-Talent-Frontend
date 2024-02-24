/**
 * These routes do not require authentication
 * @type {string[]}
 */
export const publicRoutes: string[] = [
  '/',
  '/about',
  '/auth/signin',
  '/auth/signup',
  '/auth/passwordForget',
  '/auth/passwordReset',
  '/auth/passwordResetSuccess',
  '/auth/emailVerify',
  '/auth/emailVerified',
];

/**
 * These routes are used for authentication purposes,
 * if user is logged in, they will be redirected to the default redirect path
 * @type {string[]}
 */
export const authRoutes: string[] = ['/auth/signin', '/auth/signup'];

/**
 * Routes that start with this prefix are used for API authentication purposes
 * @type {string}
 */
export const apiAuthPrefix: string = '/api/auth';

/**
 * The default redirect path after logging in
 * @type {string}
 */
export const DEFAULT_LOGIN_REDIRECT: string = '/auth/onboarding';
