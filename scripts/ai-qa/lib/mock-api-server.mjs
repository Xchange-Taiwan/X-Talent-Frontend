// A small standalone HTTP server that stands in for the real backend during
// QA runs. Deliberately NOT MSW: MSW is a request-interception library that
// patches the process making the requests — it doesn't fit here because the
// QA dev server runs as a separate child process (see server.mjs), and
// getting interception working inside that process would mean wiring
// `instrumentation.ts` + a browser service worker into the actual Next.js
// app source (src/), which is a much bigger footprint than this needs.
// Instead: `src/lib/apiClient.ts` and `src/auth.config.ts` both read
// `NEXT_PUBLIC_API_URL` at request time, and the QA dev server is a fresh
// `next dev` process we spawn ourselves — pointing that one env var at a
// real (if tiny) local HTTP server covers both client- and server-side
// calls with zero changes to app source. See qa-bridge.mjs for the wiring.
import { createServer } from 'node:http';

import { getSchemaMockFixture } from './schema-mock.mjs';

// Shared with auth-fixtures.mjs, which logs in with these fixed emails when
// no real QA_TEST_ACCOUNT_* credentials are configured — the mock server
// doesn't check passwords, only which sentinel email decides the role.
export const MENTOR_SENTINEL_EMAIL = 'qa-mentor@mock.local';
export const MENTEE_SENTINEL_EMAIL = 'qa-mentee@mock.local';

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

/** Matches the shape auth.config.ts's authorize() parses (see scripts/ai-qa/lib/auth-fixtures.mjs). */
function loginResponseFor(email) {
  const isMentor = email === MENTOR_SENTINEL_EMAIL;
  return {
    data: {
      auth: {
        user_id: isMentor ? 9001 : 9002,
        token: `mock-access-token-${isMentor ? 'mentor' : 'mentee'}`,
        email,
      },
      user: {
        name: isMentor ? 'QA Mentor' : 'QA Mentee',
        onboarding: true,
        is_mentor: isMentor,
        avatar: null,
        avatar_updated_at: null,
        job_title: '',
        company: '',
        experiences: [],
      },
    },
  };
}

/**
 * `routes` is a Map keyed by `METHOD path` (exact match — scenario/fixture
 * paths are concrete, not patterns) to a handler `(parsedBody, req) => { status, body }`.
 * Lookup order per request: (1) an exact-match registered route (login, or
 * one the fixture planner/a scenario registered — realistic, scenario-aware
 * data); (2) a generic baseline sampled from the OpenAPI contract (see
 * schema-mock.mjs) for any endpoint the contract defines but nobody
 * registered a fixture for; (3) 404. Only a path the contract doesn't define
 * at all reaches the 404 — a silently "successful" wrong-shaped response for
 * an endpoint that isn't even real is the "ghost mock masking a real bug"
 * risk flagged in issue #318's Risks section, so that case still 404s loudly
 * instead of returning a generic empty-but-valid body.
 */
export function createMockApiServer() {
  const routes = new Map();

  routes.set('POST /v1/auth/login', async (body) => ({
    status: 200,
    body: loginResponseFor(body?.email),
    headers: { 'set-cookie': 'refresh_token=mock-refresh-token; Path=/' },
  }));

  function registerHandler(method, path, handler) {
    routes.set(`${method.toUpperCase()} ${path}`, handler);
  }

  function reset() {
    // Keep the baseline login handler; drop everything registered on top of it.
    for (const key of routes.keys()) {
      if (key !== 'POST /v1/auth/login') routes.delete(key);
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const key = `${req.method} ${url.pathname}`;
    let handler = routes.get(key);

    if (!handler) {
      const schemaFixture = getSchemaMockFixture(req.method, url.pathname);
      if (schemaFixture) {
        console.log(
          `[ai-qa] mock-api-server: no fixture registered for ${key}, serving a generic ` +
            'schema-sampled baseline from the OpenAPI contract (see schema-mock.mjs)'
        );
        handler = async () => schemaFixture;
      }
    }

    if (!handler) {
      console.warn(`[ai-qa] mock-api-server: no fixture registered for ${key}`);
      sendJson(res, 404, {
        msg:
          `No mock fixture registered for ${key}, and it isn't in the OpenAPI contract either. ` +
          'Add one via the fixture planner, or this endpoint is unexpected for this ticket.',
      });
      return;
    }

    let body;
    try {
      body = await jsonBody(req);
    } catch {
      sendJson(res, 400, { msg: 'Invalid JSON body' });
      return;
    }

    try {
      const result = await handler(body, req);
      sendJson(res, result.status ?? 200, result.body, result.headers ?? {});
    } catch (err) {
      sendJson(res, 500, { msg: `Mock handler threw: ${err.message}` });
    }
  });

  return { server, registerHandler, reset };
}

/**
 * Not registered with proc.mjs's child-process tracking — this listener
 * lives in-process (unlike the dev servers, which are separate OS
 * processes spawned via cross-spawn), so it dies for free when the ai:dev
 * process exits. Callers must still call `stop()` explicitly in the normal
 * (non-interrupted) path to free the port between iterations.
 */
export async function startMockApiServer() {
  const { server, registerHandler, reset } = createMockApiServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    registerHandler,
    reset,
    async stop() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
