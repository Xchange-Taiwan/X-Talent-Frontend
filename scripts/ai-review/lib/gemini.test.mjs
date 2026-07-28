// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini } from './gemini.mjs';

function candidateResponse(text, { finishReason = 'STOP', status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      candidates: [{ finishReason, content: { parts: [{ text }] } }],
    }),
    text: async () => text,
  };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  vi.stubGlobal('setTimeout', (fn) => fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe('callGemini', () => {
  it('parses a clean JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(candidateResponse('{"ok":true}'))
    );

    await expect(callGemini('prompt')).resolves.toEqual({ ok: true });
  });

  it('recovers the JSON object when trailing garbage follows it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(candidateResponse('{"ok":true}}'))
    );

    await expect(callGemini('prompt')).resolves.toEqual({ ok: true });
  });

  it('does not miscount braces that appear inside string values', async () => {
    const text = '{"note":"contains { and } inside a string","ok":true}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(candidateResponse(text))
    );

    await expect(callGemini('prompt')).resolves.toEqual({
      note: 'contains { and } inside a string',
      ok: true,
    });
  });

  it('does not end a string early on an escaped quote', async () => {
    const text = '{"note":"a \\"quoted\\" word","ok":true}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(candidateResponse(text))
    );

    await expect(callGemini('prompt')).resolves.toEqual({
      note: 'a "quoted" word',
      ok: true,
    });
  });

  it('retries on a 5xx error and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      })
      .mockResolvedValueOnce(candidateResponse('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt')).rejects.toThrow(
      'Gemini API error (400)'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws immediately without retrying when truncated by MAX_TOKENS', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        candidateResponse('{"incomplete', { finishReason: 'MAX_TOKENS' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt')).rejects.toThrow('MAX_TOKENS');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
