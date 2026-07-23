const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const DEFAULT_MAX_OUTPUT_TOKENS = 16384;

/**
 * Calls the Gemini API with a text prompt and expects a JSON response.
 * The prompt itself is responsible for instructing the model to return JSON.
 */
export async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const maxOutputTokens =
    Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;

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
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      `Gemini API returned no content (finishReason: ${candidate?.finishReason ?? 'unknown'})`
    );
  }

  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new Error(
      `Gemini response was truncated (finishReason: MAX_TOKENS, maxOutputTokens: ${maxOutputTokens}). ` +
        'Set GEMINI_MAX_OUTPUT_TOKENS higher or shorten the prompt/diff.'
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse Gemini response as JSON (finishReason: ${candidate.finishReason}): ${text.slice(0, 500)}`
    );
  }
}
