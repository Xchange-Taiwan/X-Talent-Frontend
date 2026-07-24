// Independent from scripts/ai-review/lib/gemini.mjs on purpose: the reviewer
// client is single-turn text-in/JSON-out, this one needs multi-turn history,
// `tools`/`systemInstruction`, and functionCall/functionResponse parts — none
// of which the reviewer payload shape supports. Keeping them separate means
// changes here can never destabilize the CI ai-review pipeline.

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gemini API error (${res.status}): ${errText}`);
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  const data = await res.json();
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
    tools: [{ functionDeclarations: tools }],
    generationConfig: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS },
  };

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
