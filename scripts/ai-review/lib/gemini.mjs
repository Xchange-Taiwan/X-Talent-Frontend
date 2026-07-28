const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const DEFAULT_MAX_OUTPUT_TOKENS = 16384;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

/**
 * Scans from the first `{` and returns the substring up to its matching
 * closing brace, ignoring braces inside strings. Gemini occasionally emits
 * valid JSON followed by stray trailing characters (e.g. an extra `}`)
 * even with responseMimeType: 'application/json' — this recovers the
 * well-formed object instead of failing the whole call on garbage that
 * comes after it.
 */
function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce(promptText, { model, maxOutputTokens, apiKey }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gemini API error (${res.status}): ${errText}`);
    // 5xx and 429 (rate limit — expected when 7 review agents hit the API
    // in parallel) are transient; other 4xx (bad key, bad request) won't be
    // fixed by retrying.
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    const err = new Error(
      `Gemini API returned no content (finishReason: ${candidate?.finishReason ?? 'unknown'})`
    );
    err.retryable = true;
    throw err;
  }

  if (candidate.finishReason === 'MAX_TOKENS') {
    const err = new Error(
      `Gemini response was truncated (finishReason: MAX_TOKENS, maxOutputTokens: ${maxOutputTokens}). ` +
        'Set GEMINI_MAX_OUTPUT_TOKENS higher or shorten the prompt/diff.'
    );
    // Retrying won't help — the same prompt will hit the same cap again.
    err.retryable = false;
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch {
    const recovered = extractFirstJsonObject(text);
    if (recovered) {
      try {
        return JSON.parse(recovered);
      } catch {
        // fall through to the error below
      }
    }
    // Log the full response (not just a truncated excerpt) so an
    // unparseable output is actually debuggable if every retry fails.
    console.error(
      `[gemini] unparsable response (finishReason: ${candidate.finishReason}):\n${text}`
    );
    const err = new Error(
      `Failed to parse Gemini response as JSON (finishReason: ${candidate.finishReason}); full response logged above`
    );
    err.retryable = true;
    throw err;
  }
}

/**
 * Calls the Gemini API with a text prompt and expects a JSON response.
 * The prompt itself is responsible for instructing the model to return JSON.
 *
 * Retries a few times on transient failures (malformed/empty output, 5xx)
 * since these have empirically been "fails once, succeeds on the next
 * identical call" — not worth failing an entire pipeline run over.
 */
export async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const maxOutputTokens =
    Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(promptText, {
        model,
        maxOutputTokens,
        apiKey,
      });
    } catch (err) {
      lastErr = err;
      // A raw fetch/network failure (DNS, connection reset) throws a plain
      // TypeError with no `retryable` flag at all — treat "not explicitly
      // false" as retryable so those transient errors aren't mistaken for
      // the deliberately-non-retryable ones (e.g. MAX_TOKENS) above.
      const canRetry = err.retryable !== false && attempt < MAX_ATTEMPTS;
      console.warn(
        `[gemini] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}${canRetry ? ' — retrying' : ''}`
      );
      if (!canRetry) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}
