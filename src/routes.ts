/**
 * These routes do not require authentication
 * @type {string[]}
 */
export const publicRoutes: string[] = [
  '/',
  '/about',
  '/auth/signin',
  '/auth/signup',
  '/auth/google/callback/redirect',
  '/auth/password-forgot',
  '/auth/password-forgot-success',
  '/auth/password-reset',
  '/auth/password-reset-success',
  '/auth/email-verify',
  '/auth/email-verified',
  '/profile/[pageUserId]',
  '/mentor-pool',
  '/preview/category-multi-select',
  '/preview/onboarding-step',
];

/**
 * Routes that start with this prefix are used for API authentication purposes
 * @type {string}
 */
export const apiAuthPrefix: string = '/api/auth';

/**
 * The default redirect path after logging in
 * @type {string}
 */
export const DEFAULT_LOGIN: string = '/auth/signin';
