const DEFAULT_MODEL = 'gemini-4-carbon';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash';
const DEFAULT_MAX_OUTPUT_TOKENS = 16384;
const MAX_EXPANDED_OUTPUT_TOKENS = 65536;
export const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 25000;
const RETRY_JITTER_MS = 1500;

export function computeRetryDelayMs(attempt, randomFn = Math.random) {
  const expDelay = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  );
  const jitter = Math.floor(Math.max(0, randomFn()) * RETRY_JITTER_MS);
  return expDelay + jitter;
}

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

export function buildGeminiParts(promptText, images = []) {
  const parts = [{ text: promptText }];
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img?.mimeType && img?.base64Data) {
        if (img.label) {
          parts.push({ text: `[視覺附件：${img.label}]` });
        }
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64Data,
          },
        });
      }
    }
  }
  return parts;
}

async function callGeminiOnce(
  promptText,
  { model, maxOutputTokens, apiKey, images = [] }
) {
  const parts = buildGeminiParts(promptText, images);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
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
  const text = candidate?.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');

  if (candidate?.finishReason === 'MAX_TOKENS') {
    const err = new Error(
      `Gemini response was truncated (finishReason: MAX_TOKENS, maxOutputTokens: ${maxOutputTokens}). ` +
        'Set GEMINI_MAX_OUTPUT_TOKENS higher or shorten the prompt/diff.'
    );
    err.maxTokensTruncated = true;
    err.retryable = maxOutputTokens < MAX_EXPANDED_OUTPUT_TOKENS;
    throw err;
  }

  if (!text) {
    const err = new Error(
      `Gemini API returned no content (finishReason: ${candidate?.finishReason ?? 'unknown'})`
    );
    err.retryable = true;
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
export async function callGemini(promptText, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const maxOutputTokens =
    Number(options.maxOutputTokens || process.env.GEMINI_MAX_OUTPUT_TOKENS) ||
    DEFAULT_MAX_OUTPUT_TOKENS;
  const images = Array.isArray(options.images) ? options.images : [];
  const sleepFn =
    typeof options.sleepFn === 'function' ? options.sleepFn : sleep;

  let effectiveTokens = maxOutputTokens;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(promptText, {
        model,
        maxOutputTokens: effectiveTokens,
        apiKey,
        images,
      });
    } catch (err) {
      lastErr = err;
      if (
        err.maxTokensTruncated &&
        effectiveTokens < MAX_EXPANDED_OUTPUT_TOKENS
      ) {
        effectiveTokens = Math.min(
          MAX_EXPANDED_OUTPUT_TOKENS,
          Math.max(32768, effectiveTokens * 2)
        );
      }
      // A raw fetch/network failure (DNS, connection reset) throws a plain
      // TypeError with no `retryable` flag at all — treat "not explicitly
      // false" as retryable so those transient errors aren't mistaken for
      // the deliberately-non-retryable ones (e.g. MAX_TOKENS) above.
      const canRetry = err.retryable !== false && attempt < MAX_ATTEMPTS;
      console.warn(
        `[gemini] attempt ${attempt}/${MAX_ATTEMPTS} (${model}) failed: ${err.message}${canRetry ? ' — retrying' : ''}`
      );
      if (!canRetry) break;
      await sleepFn(computeRetryDelayMs(attempt));
    }
  }

  const fallbackModel =
    options.fallbackModel === null
      ? null
      : options.fallbackModel ||
        process.env.GEMINI_FALLBACK_MODEL ||
        DEFAULT_FALLBACK_MODEL;

  if (
    lastErr &&
    lastErr.retryable !== false &&
    fallbackModel &&
    fallbackModel !== model
  ) {
    console.warn(
      `[gemini] primary model ${model} exhausted ${MAX_ATTEMPTS} attempts; falling back to ${fallbackModel}`
    );
    try {
      return await callGeminiOnce(promptText, {
        model: fallbackModel,
        maxOutputTokens: effectiveTokens,
        apiKey,
        images,
      });
    } catch (fallbackErr) {
      console.warn(
        `[gemini] fallback model ${fallbackModel} also failed: ${fallbackErr.message}`
      );
    }
  }

  throw lastErr;
}
