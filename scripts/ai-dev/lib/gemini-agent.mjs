// Independent from scripts/ai-review/lib/gemini.mjs on purpose: the reviewer
// client is single-turn text-in/JSON-out, this one needs multi-turn history,
// `tools`/`systemInstruction`, and functionCall/functionResponse parts — none
// of which the reviewer payload shape supports. Keeping them separate means
// changes here can never destabilize the CI ai-review pipeline.

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
// Node's native fetch has no default timeout — a network black hole or a
// hung server would leave this Promise pending forever, which means the
// retry loop below never even gets a chance to run. Generous ceiling since
// dev-agent turns (large maxOutputTokens) can legitimately take a while to
// generate.
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MODEL =
  process.env.GEMINI_DEV_MODEL ||
  process.env.GEMINI_MODEL ||
  'gemini-3.1-pro-preview';
// Higher ceiling than the reviewer's 16384 default — dev-agent turns can
// include a full file body in a writeFile function-call arg.
const DEFAULT_MAX_OUTPUT_TOKENS =
  Number(process.env.GEMINI_DEV_MAX_OUTPUT_TOKENS) || 32768;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOnce(body, { apiKey, model }) {
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
  } catch (err) {
    // fetch() itself throwing (DNS failure, connection reset, our own
    // AbortSignal.timeout firing) never reaches the res.ok check below, so
    // it needs its own retryable tag — otherwise a network blip aborts the
    // whole run on the first hiccup.
    const wrapped = new Error(`Gemini API request failed: ${err.message}`);
    wrapped.retryable = true;
    throw wrapped;
  }

  if (!res.ok) {
    let errText;
    try {
      errText = await res.text();
    } catch (err) {
      // Reading the body can itself fail (connection dropped mid-read) —
      // without this, that raw error skips the retryable flag entirely and
      // aborts the run instead of retrying.
      const wrapped = new Error(
        `Gemini API error (${res.status}), and failed to read the error body: ${err.message}`
      );
      wrapped.retryable = true;
      throw wrapped;
    }
    const err = new Error(`Gemini API error (${res.status}): ${errText}`);
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    // A 200 that isn't valid JSON (truncated body, proxy returning HTML,
    // etc.) is almost certainly transient — same reasoning as above.
    const wrapped = new Error(
      `Failed to parse Gemini API response as JSON: ${err.message}`
    );
    wrapped.retryable = true;
    throw wrapped;
  }
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const err = new Error('Gemini API returned no candidate.');
    err.retryable = true;
    throw err;
  }
  return candidate;
}

/**
 * Runs one turn of the dev-agent conversation. `contents` is the full running
 * history (see appendModelTurn/appendFunctionResponseTurn below) — callers
 * own truncation of that history between orchestrator iterations, this
 * function just sends whatever it's given.
 */
export async function callGeminiAgent({ systemInstruction, contents, tools }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS },
  };
  // The Gemini API rejects an empty functionDeclarations array with a 400 —
  // omit the whole `tools` field rather than sending `[{ functionDeclarations: [] }]`.
  // Not currently reachable via orchestrator.mjs (it always passes the full
  // TOOL_DECLARATIONS), but this is an exported, general-purpose function.
  if (tools && tools.length > 0) {
    body.tools = [{ functionDeclarations: tools }];
  }

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const candidate = await callOnce(body, { apiKey, model: DEFAULT_MODEL });
      if (candidate.finishReason === 'MAX_TOKENS') {
        // Not retryable — the same input will hit the same cap again. Most
        // likely cause: a writeFile call for a file too large for one shot
        // (the existing-file size guard in tools.mjs prevents this for edits;
        // a brand-new huge file can still trigger it — known v1 limitation).
        throw new Error(
          'Gemini response was truncated (MAX_TOKENS). The requested change likely produced ' +
            'too much output for a single turn — ask for a smaller/narrower change.'
        );
      }
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        // Most commonly SAFETY (content filter blocked the response) or
        // OTHER — the candidate exists (so the earlier !candidate check
        // doesn't catch it) but content/parts is typically empty, which
        // the orchestrator's "no function calls, nudge and retry" fallback
        // can't distinguish from the model just needing a push — it would
        // silently loop on the same blocked input until MAX_TURNS_PER_ITERATION.
        // Not retryable: the same input will very likely get blocked the same way.
        throw new Error(
          `Gemini response was blocked or incomplete (finishReason: ${candidate.finishReason}). ` +
            'This usually means the safety filter triggered — check the ticket content.'
        );
      }
      return candidate;
    } catch (err) {
      lastErr = err;
      const canRetry = err.retryable && attempt < MAX_ATTEMPTS;
      console.warn(
        `[gemini-agent] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}${canRetry ? ' — retrying' : ''}`
      );
      if (!canRetry) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

export function userTurn(text) {
  return { role: 'user', parts: [{ text }] };
}

export function modelTurnFromCandidate(candidate) {
  return { role: 'model', parts: candidate.content?.parts ?? [] };
}

/** Synthesizes a model turn from plain text rather than a live API candidate —
 * used to persist a compressed "what the agent answered" turn across
 * follow-up rounds without replaying its full tool-call trace (see
 * orchestrator.mjs's runFollowUpSession). */
export function modelTextTurn(text) {
  return { role: 'model', parts: [{ text }] };
}

export function functionResponseTurn(results) {
  return {
    role: 'function',
    parts: results.map(({ name, response }) => ({
      functionResponse: { name, response },
    })),
  };
}

/** Returns `{ name, args }` for every functionCall part in the candidate, in the order Gemini returned them. */
export function extractFunctionCalls(candidate) {
  const parts = candidate.content?.parts ?? [];
  return parts
    .filter((p) => p.functionCall)
    .map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args ?? {},
    }));
}

export function extractText(candidate) {
  const parts = candidate.content?.parts ?? [];
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join('\n');
}
