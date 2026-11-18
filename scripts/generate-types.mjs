import { execSync } from 'child_process';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path, { join } from 'path';
import { pathToFileURL } from 'url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchOpenApiSpecWithRetry(
  url,
  {
    timeoutMs = 15000,
    maxAttempts = 3,
    baseDelayMs = 1500,
    fetchImpl = fetch,
    sleepFn = sleep,
  } = {}
) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const statusErr = new Error(
          `failed to fetch OpenAPI spec from ${url}: ${res.status}`
        );
        statusErr.retryable = res.status >= 500 || res.status === 429;
        throw statusErr;
      }
      const specText = await res.text();
      return JSON.parse(specText);
    } catch (err) {
      lastError = err;
      const canRetry = err?.retryable !== false && attempt < maxAttempts;
      if (!canRetry) break;
      await sleepFn(baseDelayMs * attempt);
    }
  }

  throw lastError || new Error(`failed to fetch OpenAPI spec from ${url}`);
}

export async function generateOpenApiTypes({
  url = process.env.BFF_OPENAPI_URL,
  outPath = 'src/types/api.ts',
  fetchImpl = fetch,
  sleepFn = sleep,
  execImpl = execSync,
} = {}) {
  if (!url) {
    throw new Error('BFF_OPENAPI_URL is not set. Add it to your .env file.');
  }

  const parsedSpec = await fetchOpenApiSpecWithRetry(url, {
    fetchImpl,
    sleepFn,
  });
  const specPath = join(tmpdir(), 'openapi-spec.json');
  writeFileSync(specPath, `${JSON.stringify(parsedSpec, null, 2)}\n`);

  execImpl(`openapi-typescript "${specPath}" -o "${outPath}"`, {
    stdio: 'inherit',
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  config();
  config({ path: '.env.development.local', override: true });
  generateOpenApiTypes().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
