// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  callGeminiAgent,
  extractFunctionCalls,
  extractText,
  functionResponseTurn,
  modelTurnFromCandidate,
  userTurn,
} from './gemini-agent.mjs';

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function stopCandidateWithFunctionCall() {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              functionCall: {
                name: 'writeFile',
                args: { path: 'a.ts', content: 'x' },
              },
            },
          ],
        },
      },
    ],
  };
}

function stopCandidateWithText(text) {
  return {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  };
}

const baseArgs = {
  systemInstruction: 'sys',
  contents: [userTurn('hi')],
  tools: [],
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.GEMINI_API_KEY;
});

describe('callGeminiAgent — preconditions', () => {
  it('throws immediately when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(callGeminiAgent(baseArgs)).rejects.toThrow(
      'GEMINI_API_KEY is not set'
    );
  });
});

describe('callGeminiAgent — success paths', () => {
  it('returns the candidate on a clean STOP response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithFunctionCall()));
    vi.stubGlobal('fetch', fetchMock);

    const candidate = await callGeminiAgent(baseArgs);
    expect(candidate.finishReason).toBe('STOP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends systemInstruction, contents, and tools in the request body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiAgent({
      systemInstruction: 'be helpful',
      contents: [userTurn('do it')],
      tools: [{ name: 'x' }],
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'be helpful' }] });
    expect(body.tools).toEqual([{ functionDeclarations: [{ name: 'x' }] }]);
    expect(body.contents).toEqual([userTurn('do it')]);
  });

  it('omits the tools field entirely when given an empty array, instead of sending an invalid empty functionDeclarations', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiAgent({ systemInstruction: 'sys', contents: [userTurn('hi')], tools: [] });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).not.toHaveProperty('tools');
  });
});

describe('callGeminiAgent — non-retryable failure modes', () => {
  it('throws a clear error on MAX_TOKENS without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        candidates: [{ finishReason: 'MAX_TOKENS', content: {} }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGeminiAgent(baseArgs)).rejects.toThrow(/MAX_TOKENS/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when the safety filter blocks the response, without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ finishReason: 'SAFETY', content: {} }] })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGeminiAgent(baseArgs)).rejects.toThrow(
      /blocked or incomplete/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a 4xx client error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'bad request' }, { status: 400 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGeminiAgent(baseArgs)).rejects.toThrow(
      /Gemini API error \(400\)/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('callGeminiAgent — retryable failure modes', () => {
  it('retries once on a 5xx error then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'oops' }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('recovered')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    const candidate = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(extractText(candidate)).toBe('recovered');
  });

  it('retries on a 429 rate-limit response then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'rate limited' }, { status: 429 })
      )
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a raw network failure (fetch() itself throwing) then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries when the request times out (AbortSignal.timeout firing) then succeeds', async () => {
    vi.useFakeTimers();
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError'
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes an AbortSignal to fetch so a hung request cannot block forever', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiAgent(baseArgs);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries when the response body fails to parse as JSON on an otherwise-200 response', async () => {
    vi.useFakeTimers();
    const malformedResponse = {
      ok: true,
      status: 200,
      text: async () => 'not json',
      json: async () => {
        throw new SyntaxError('Unexpected token n in JSON');
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(malformedResponse)
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries when reading the error body itself fails on a non-2xx response', async () => {
    vi.useFakeTimers();
    const brokenErrorResponse = {
      ok: false,
      status: 503,
      text: async () => {
        throw new Error('connection reset while reading body');
      },
      json: async () => ({}),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(brokenErrorResponse)
      .mockResolvedValueOnce(jsonResponse(stopCandidateWithText('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting all retry attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: 'still down' }, { status: 500 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGeminiAgent(baseArgs);
    // Attach the rejection handler before advancing timers — otherwise the
    // promise can reject during the advance calls below with nothing
    // listening yet, which Node flags as an unhandled rejection even though
    // it does get handled a tick later.
    const assertion = expect(promise).rejects.toThrow(
      /Gemini API error \(500\)/
    );
    // MAX_ATTEMPTS=3 -> two retry delays: 1500ms then 3000ms
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('conversation-shaping helpers', () => {
  it('userTurn wraps text in a user-role content object', () => {
    expect(userTurn('hello')).toEqual({
      role: 'user',
      parts: [{ text: 'hello' }],
    });
  });

  it('modelTurnFromCandidate copies the candidate parts into a model-role turn', () => {
    const candidate = stopCandidateWithFunctionCall().candidates[0];
    expect(modelTurnFromCandidate(candidate)).toEqual({
      role: 'model',
      parts: candidate.content.parts,
    });
  });

  it('modelTurnFromCandidate tolerates a candidate with no content', () => {
    expect(modelTurnFromCandidate({})).toEqual({ role: 'model', parts: [] });
  });

  it('functionResponseTurn wraps results as a function-role turn', () => {
    const turn = functionResponseTurn([
      { name: 'writeFile', response: { ok: true } },
    ]);
    expect(turn).toEqual({
      role: 'function',
      parts: [
        { functionResponse: { name: 'writeFile', response: { ok: true } } },
      ],
    });
  });

  it('extractFunctionCalls pulls out every functionCall part in order', () => {
    const candidate = {
      content: {
        parts: [
          { text: 'thinking...' },
          { functionCall: { name: 'readFile', args: { path: 'a.ts' } } },
          { functionCall: { name: 'writeFile', args: {} } },
        ],
      },
    };
    expect(extractFunctionCalls(candidate)).toEqual([
      { name: 'readFile', args: { path: 'a.ts' } },
      { name: 'writeFile', args: {} },
    ]);
  });

  it('extractFunctionCalls returns an empty array when there are no function calls', () => {
    expect(
      extractFunctionCalls(stopCandidateWithText('just text').candidates[0])
    ).toEqual([]);
  });

  it('extractText joins every text part and ignores functionCall parts', () => {
    const candidate = {
      content: {
        parts: [
          { text: 'line one' },
          { functionCall: { name: 'x', args: {} } },
          { text: 'line two' },
        ],
      },
    };
    expect(extractText(candidate)).toBe('line one\nline two');
  });
});
