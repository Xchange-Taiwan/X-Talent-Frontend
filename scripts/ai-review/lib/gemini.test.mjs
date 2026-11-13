// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callGemini, computeRetryDelayMs } from './gemini.mjs';

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
  it('parses a clean JSON response and targets gemini-4-carbon by default', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidateResponse('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('models/gemini-4-carbon:generateContent'),
      expect.any(Object)
    );
  });

  it('ignores thought parts before parsing the JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { thought: true, text: 'thinking about the diff...' },
                  { text: '{"ok":true}' },
                ],
              },
            },
          ],
        }),
        text: async () => '',
      })
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

  it('retries on a 429 rate-limit error and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      })
      .mockResolvedValueOnce(candidateResponse('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a raw network error (fetch rejects with no `retryable` flag) and succeeds next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
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

  it('expands maxOutputTokens (16384 -> 32768 -> 65536) and retries when truncated by MAX_TOKENS (including empty parts)', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }],
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce(
        candidateResponse('{"incomplete', { finishReason: 'MAX_TOKENS' })
      )
      .mockResolvedValueOnce(candidateResponse('{"ok":"expanded"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt', { sleepFn: noopSleep })).resolves.toEqual(
      { ok: 'expanded' }
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const req1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const req2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    const req3 = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(req1.generationConfig.maxOutputTokens).toBe(16384);
    expect(req2.generationConfig.maxOutputTokens).toBe(32768);
    expect(req3.generationConfig.maxOutputTokens).toBe(65536);
  });

  it('stops retrying immediately and throws MAX_TOKENS once maxOutputTokens reaches 65536', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        candidateResponse('{"incomplete', { finishReason: 'MAX_TOKENS' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callGemini('prompt', { maxOutputTokens: 65536, sleepFn: noopSleep })
    ).rejects.toThrow('MAX_TOKENS');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('carries expanded maxOutputTokens to fallbackModel when primary model exhausts transient retries', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    const unavailable = {
      ok: false,
      status: 503,
      text: async () => 'UNAVAILABLE',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        candidateResponse('{"incomplete', { finishReason: 'MAX_TOKENS' })
      )
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(candidateResponse('{"ok":"fallback-65k"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callGemini('prompt', { maxOutputTokens: 32768, sleepFn: noopSleep })
    ).resolves.toEqual({ ok: 'fallback-65k' });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[5][0]).toContain(
      'models/gemini-2.5-flash:generateContent'
    );
    const fallbackBody = JSON.parse(fetchMock.mock.calls[5][1].body);
    expect(fallbackBody.generationConfig.maxOutputTokens).toBe(65536);
  });

  it('uses exponential backoff with jitter across up to 5 primary attempts and falls back to gemini-2.5-flash when 503 persists', async () => {
    expect(computeRetryDelayMs(1, () => 0)).toBe(2000);
    expect(computeRetryDelayMs(2, () => 0.5)).toBe(4750);
    expect(computeRetryDelayMs(3, () => 0)).toBe(8000);
    expect(computeRetryDelayMs(4, () => 0)).toBe(16000);
    expect(computeRetryDelayMs(5, () => 0)).toBe(25000);

    const sleepSpy = vi.fn().mockResolvedValue(undefined);
    const unavailable = {
      ok: false,
      status: 503,
      text: async () => 'UNAVAILABLE',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(candidateResponse('{"ok":"from-fallback"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini('prompt', { sleepFn: sleepSpy })).resolves.toEqual({
      ok: 'from-fallback',
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(sleepSpy).toHaveBeenCalledTimes(4);
    expect(sleepSpy.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
    expect(sleepSpy.mock.calls[3][0]).toBeGreaterThanOrEqual(16000);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'models/gemini-4-carbon:generateContent'
    );
    expect(fetchMock.mock.calls[5][0]).toContain(
      'models/gemini-2.5-flash:generateContent'
    );
  });

  it('rethrows primary error when fallback model also fails and skips fallback when disabled or identical', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    const unavailable = {
      ok: false,
      status: 503,
      text: async () => 'UNAVAILABLE',
    };
    const fetchBothFail = vi.fn().mockResolvedValue(unavailable);
    vi.stubGlobal('fetch', fetchBothFail);

    await expect(callGemini('prompt', { sleepFn: noopSleep })).rejects.toThrow(
      'Gemini API error (503)'
    );
    expect(fetchBothFail).toHaveBeenCalledTimes(6);

    const fetchDisabledFallback = vi.fn().mockResolvedValue(unavailable);
    vi.stubGlobal('fetch', fetchDisabledFallback);

    await expect(
      callGemini('prompt', { fallbackModel: null, sleepFn: noopSleep })
    ).rejects.toThrow('Gemini API error (503)');
    expect(fetchDisabledFallback).toHaveBeenCalledTimes(5);

    const fetchSameModel = vi.fn().mockResolvedValue(unavailable);
    vi.stubGlobal('fetch', fetchSameModel);

    await expect(
      callGemini('prompt', { model: 'gemini-2.5-flash', sleepFn: noopSleep })
    ).rejects.toThrow('Gemini API error (503)');
    expect(fetchSameModel).toHaveBeenCalledTimes(5);
  });
});
