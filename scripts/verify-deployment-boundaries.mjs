#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function collectMapFiles(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const results = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.map')) {
        results.push(full);
      }
    }
  }
  return results;
}

function parseDotenvFile(envFilePath) {
  const vars = {};
  if (!envFilePath || !fs.existsSync(envFilePath)) return vars;
  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function verifyDeploymentBoundaries({
  siteUrl,
  apiUrl = '',
  routes = ['/', '/auth/signin', '/mentor-pool'],
  staticDirs = [],
  envVars = {},
  maxRetries = 3,
  retryDelayMs = 4000,
  fetchImpl = fetch,
} = {}) {
  const errors = [];
  const checkedRoutes = [];

  for (const dir of staticDirs) {
    const maps = collectMapFiles(dir);
    if (maps.length > 0) {
      errors.push(
        `Public source map (.map) files found in static directory (${maps.length} file(s), sample: ${path.basename(maps[0])})`
      );
    }
  }

  const cleanBase = String(siteUrl || '').replace(/\/+$/, '');
  if (!cleanBase && routes.length > 0) {
    errors.push('Missing target siteUrl for boundary verification');
    return { passed: false, errors, checkedRoutes, featureFlags: {} };
  }

  for (const route of routes) {
    const targetUrl = `${cleanBase}${route.startsWith('/') ? route : `/${route}`}`;
    let ok = false;
    let lastStatus = 0;
    let lastLocation = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchImpl(targetUrl, { redirect: 'manual' });
        lastStatus = res.status;
        lastLocation = res.headers?.get?.('location') || '';
        if (res.status === 200) {
          ok = true;
          break;
        }
      } catch (err) {
        lastStatus = 0;
        lastLocation = String(err?.message || err);
      }
      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
      }
    }

    checkedRoutes.push({
      route,
      status: lastStatus,
      location: lastLocation,
      ok,
    });
    if (!ok) {
      const redirectHint = lastLocation ? ` -> ${lastLocation}` : '';
      errors.push(
        `Route ${targetUrl} failed non-redirect 200 check (status=${lastStatus}${redirectHint})`
      );
    }
  }

  const cleanApi = String(apiUrl || envVars.NEXT_PUBLIC_API_URL || '').replace(
    /\/+$/,
    ''
  );
  if (cleanApi && cleanBase) {
    try {
      const expectedOrigin = new URL(cleanBase).origin;
      const oauthRes = await fetchImpl(
        `${cleanApi}/v2/oauth/google/authorize/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }
      );
      if (oauthRes.status === 200) {
        const body = await oauthRes.json();
        const authUrl =
          body?.data?.authorization_url || body?.authorization_url || '';
        if (authUrl) {
          const parsedAuth = new URL(authUrl);
          const redirectUri = parsedAuth.searchParams.get('redirect_uri') || '';
          if (redirectUri) {
            const actualOrigin = new URL(redirectUri).origin;
            if (actualOrigin !== expectedOrigin) {
              errors.push(
                `Google OAuth redirect_uri origin mismatch: expected ${expectedOrigin}, got ${actualOrigin}`
              );
            }
          }
        }
      }
    } catch {
      // Do not fail frontend deploy if optional BFF endpoint is unreachable from runner
    }
  }

  const featureFlags = {
    NEXT_PUBLIC_ENABLE_FAVORITES:
      envVars.NEXT_PUBLIC_ENABLE_FAVORITES ??
      'unset (default fail-closed in prod)',
    NEXT_PUBLIC_ENABLE_FEEDBACK:
      envVars.NEXT_PUBLIC_ENABLE_FEEDBACK ??
      'unset (default fail-closed in prod)',
  };

  return {
    passed: errors.length === 0,
    errors,
    checkedRoutes,
    featureFlags,
  };
}

function parseCli(argv) {
  const opts = {
    siteUrl: '',
    apiUrl: '',
    envFile: '',
    staticDirs: [],
    routes: ['/', '/auth/signin', '/mentor-pool'],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--site-url' && argv[i + 1]) opts.siteUrl = argv[++i];
    else if (a === '--api-url' && argv[i + 1]) opts.apiUrl = argv[++i];
    else if (a === '--env-file' && argv[i + 1]) opts.envFile = argv[++i];
    else if (a === '--static-dir' && argv[i + 1])
      opts.staticDirs.push(argv[++i]);
    else if (a === '--routes' && argv[i + 1]) {
      opts.routes = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return opts;
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  const envVars = parseDotenvFile(opts.envFile);
  const res = await verifyDeploymentBoundaries({
    siteUrl: opts.siteUrl,
    apiUrl: opts.apiUrl,
    routes: opts.routes,
    staticDirs: opts.staticDirs,
    envVars,
  });

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      `## Deployment Boundary Verification (${opts.siteUrl || 'static-only'})`,
      '',
      `- **Status**: ${res.passed ? 'PASS' : 'FAIL'}`,
      `- **NEXT_PUBLIC_ENABLE_FAVORITES**: \`${res.featureFlags.NEXT_PUBLIC_ENABLE_FAVORITES}\``,
      `- **NEXT_PUBLIC_ENABLE_FEEDBACK**: \`${res.featureFlags.NEXT_PUBLIC_ENABLE_FEEDBACK}\``,
      '',
      ...res.checkedRoutes.map(
        (r) =>
          `- \`${r.route}\`: HTTP \`${r.status}\` (${r.ok ? 'OK' : 'FAILED'})`
      ),
      ...res.errors.map((e) => `- ERROR: ${e}`),
      '',
    ].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }

  if (!res.passed) {
    for (const err of res.errors) {
      console.error(`[BoundaryCheck] ${err}`);
    }
    process.exit(1);
  }
  console.log(
    `Boundary verification passed for ${opts.siteUrl || 'artifacts'}`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
