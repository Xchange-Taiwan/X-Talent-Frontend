'use strict';

function isValidHttpUrl(raw) {
  try {
    const parsed = new URL(String(raw).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
function isLiveProductionEnv(env = process.env) {
  return env.NEXT_PUBLIC_SENTRY_ENV === 'production';
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
function validateProductionEnv(env = process.env) {
  if (!isLiveProductionEnv(env)) {
    return;
  }

  const issues = [];
  const secret = String(env.NEXTAUTH_SECRET ?? '');
  if (secret.length < 16) {
    issues.push(
      'NEXTAUTH_SECRET: must be at least 16 characters in production'
    );
  } else if (secret === 'secret' || secret === 'changeme') {
    issues.push(
      'NEXTAUTH_SECRET: must not use placeholder values in production'
    );
  }

  if (env.NEXT_PUBLIC_API_URL && !isValidHttpUrl(env.NEXT_PUBLIC_API_URL)) {
    issues.push('NEXT_PUBLIC_API_URL: must be a valid http(s) URL');
  }

  if (env.NEXT_PUBLIC_SITE_URL && !isValidHttpUrl(env.NEXT_PUBLIC_SITE_URL)) {
    issues.push('NEXT_PUBLIC_SITE_URL: must be a valid http(s) URL');
  }

  if (issues.length > 0) {
    throw new Error(
      `Invalid production environment configuration: ${issues.join('; ')}`
    );
  }
}

module.exports = {
  isLiveProductionEnv,
  validateProductionEnv,
};
