import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';

config({ path: path.resolve('.env.development.local') });

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

// Kept separate from E2E_EMAIL/E2E_PASSWORD (the Playwright e2e suite's forged-session
// credentials, see e2e/helpers/session.ts) — this script always logs in for real.
const ROLE_CREDENTIALS = {
  mentor: {
    email: 'DESIGN_AUDIT_MENTOR_EMAIL',
    password: 'DESIGN_AUDIT_MENTOR_PASSWORD',
  },
  mentee: {
    email: 'DESIGN_AUDIT_MENTEE_EMAIL',
    password: 'DESIGN_AUDIT_MENTEE_PASSWORD',
  },
};

const FLAGS_WITH_VALUE = [
  '--routes',
  '--role',
  '--viewport',
  '--out',
  '--base-url',
];

function parseArgs(argv) {
  const parsed = {
    routes: [],
    role: 'visitor',
    viewport: 'desktop',
    outDir: '.agents/tmp/evidence',
    baseUrl: 'http://localhost:3000',
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (FLAGS_WITH_VALUE.includes(flag) && i + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    switch (flag) {
      case '--routes':
        parsed.routes = argv[++i].split(',').map((r) => r.trim());
        break;
      case '--role':
        parsed.role = argv[++i];
        break;
      case '--viewport':
        parsed.viewport = argv[++i];
        break;
      case '--out':
        parsed.outDir = argv[++i];
        break;
      case '--base-url':
        parsed.baseUrl = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (parsed.routes.length === 0) {
    throw new Error(
      'Usage: node scripts/capture-ui-evidence.mjs --routes /a,/b --role visitor|mentee|mentor [--viewport desktop|mobile] [--out dir] [--base-url url]'
    );
  }
  if (!VIEWPORTS[parsed.viewport]) {
    throw new Error(
      `Unknown --viewport "${parsed.viewport}". Expected one of: ${Object.keys(VIEWPORTS).join(', ')}`
    );
  }
  if (parsed.role !== 'visitor' && !ROLE_CREDENTIALS[parsed.role]) {
    throw new Error(
      `Unknown --role "${parsed.role}". Expected one of: visitor, ${Object.keys(ROLE_CREDENTIALS).join(', ')}`
    );
  }

  return parsed;
}

// Deliberately separate from signIn(): a missing env var is a plain config
// error containing no secret (only the var *names*), and must reach the
// user un-redacted. Keeping this check outside signIn()'s try/catch means
// it can never get caught up in the credential-redaction path below.
function resolveCredentials(role) {
  const cred = ROLE_CREDENTIALS[role];
  const email = process.env[cred.email];
  const password = process.env[cred.password];
  if (!email || !password) {
    throw new Error(
      `${cred.email} / ${cred.password} must be set in .env.development.local to capture evidence as "${role}".`
    );
  }
  return { email, password };
}

// Mirrors e2e/fixtures/auth.setup.ts: the auth Lambda can cold-start, so the
// first sign-in occasionally times out even though it actually completed. Each
// retry re-navigates to /auth/signin first and treats an immediate redirect
// away from it as success, so a slow-but-successful prior attempt doesn't get
// stuck retrying against a page that's no longer showing the form.
async function signIn(page, email, password) {
  const MAX_ATTEMPTS = 3;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto('/auth/signin');
      if (!page.url().includes('/auth/signin')) return;

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), {
        timeout: 25_000,
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function fileNameFor(role, viewport, route) {
  // Routes can carry a query string (e.g. /profile?tab=settings); `?`, `=`,
  // and friends are illegal in Windows filenames, so collapse anything that
  // isn't alphanumeric/dash/underscore instead of just swapping slashes.
  const slug =
    route === '/'
      ? 'root'
      : route.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9-_]+/g, '_');
  return `${role}-${viewport}-${slug}.png`;
}

async function main() {
  const { routes, role, viewport, outDir, baseUrl } = parseArgs(
    process.argv.slice(2)
  );
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    baseURL: baseUrl,
  });
  const page = await context.newPage();

  try {
    if (role !== 'visitor') {
      const { email, password } = resolveCredentials(role);
      try {
        await signIn(page, email, password);
      } catch {
        // Report and exit right here instead of re-throwing: a Playwright
        // timeout/action error can echo back the value it was acting on
        // (here, potentially the password), so the original error object
        // must never reach the generic catch below or its console.error.
        console.error(
          `sign-in failed for role "${role}" (details withheld: may contain credentials)`
        );
        process.exitCode = 1;
        return;
      }
    }

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const filePath = path.join(outDir, fileNameFor(role, viewport, route));
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(filePath);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
