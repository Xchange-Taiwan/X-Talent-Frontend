// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';

import {
  MENTEE_SENTINEL_EMAIL,
  MENTOR_SENTINEL_EMAIL,
  startMockApiServer,
} from './mock-api-server.mjs';

let mock;

afterEach(async () => {
  if (mock) await mock.stop();
  mock = undefined;
});

describe('mock API server — baseline login handler', () => {
  it('resolves the mentor sentinel email to isMentor:true', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MENTOR_SENTINEL_EMAIL, password: 'x' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.user.is_mentor).toBe(true);
  });

  it('resolves the mentee sentinel email (and any other email) to isMentor:false', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MENTEE_SENTINEL_EMAIL, password: 'x' }),
    });
    const json = await res.json();
    expect(json.data.user.is_mentor).toBe(false);
  });

  it('sets a refresh_token cookie on login', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MENTOR_SENTINEL_EMAIL, password: 'x' }),
    });
    expect(res.headers.get('set-cookie')).toContain('refresh_token=');
  });
});

describe('mock API server — dynamic fixtures', () => {
  it('serves a registered fixture', async () => {
    mock = await startMockApiServer();
    mock.registerHandler('GET', '/v1/jobs/1', async () => ({
      status: 200,
      body: { data: { id: 1, title: 'Mock Job' } },
    }));

    const res = await fetch(`${mock.url}/v1/jobs/1`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe('Mock Job');
  });

  it('404s loudly for an unregistered route instead of returning a generic success', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('reset() clears registered fixtures but keeps the baseline login handler', async () => {
    mock = await startMockApiServer();
    mock.registerHandler('GET', '/v1/jobs/1', async () => ({
      status: 200,
      body: { data: {} },
    }));
    mock.reset();

    const jobRes = await fetch(`${mock.url}/v1/jobs/1`);
    expect(jobRes.status).toBe(404);

    const loginRes = await fetch(`${mock.url}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MENTOR_SENTINEL_EMAIL, password: 'x' }),
    });
    expect(loginRes.status).toBe(200);
  });
});

describe('mock API server — OpenAPI schema-sampled baseline fallback', () => {
  it('serves a generic baseline for a real contract endpoint with no registered fixture', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/users/zh_TW/tags/catalog`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual(expect.objectContaining({ data: expect.anything() }));
  });

  it('an exact-match registered fixture still wins over the schema baseline', async () => {
    mock = await startMockApiServer();
    mock.registerHandler('GET', '/v1/users/zh_TW/tags/catalog', async () => ({
      status: 200,
      body: {
        data: { language: 'zh_TW', catalogs: { skill: { kind: 'skill' } } },
      },
    }));

    const res = await fetch(`${mock.url}/v1/users/zh_TW/tags/catalog`);
    const json = await res.json();
    expect(json.data.catalogs.skill.kind).toBe('skill');
  });

  it('still 404s for a path that is not in the OpenAPI contract at all', async () => {
    mock = await startMockApiServer();
    const res = await fetch(`${mock.url}/v1/nonexistent`);
    expect(res.status).toBe(404);
  });
});
