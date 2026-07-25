import { config } from 'dotenv';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

config();
config({ path: '.env.development.local', override: true });

const url = process.env.BFF_OPENAPI_URL;
if (!url) {
  console.error('Error: BFF_OPENAPI_URL is not set. Add it to your .env file.');
  process.exit(1);
}

// Fetched once and snapshotted to scripts/ai-qa/openapi-spec.json so the QA
// mock server's schema-driven baseline fixtures (see schema-mock.mjs) have a
// contract to sample from without a live network call during test runs, and
// stay in sync with src/types/api.ts automatically whenever this regenerates.
const res = await fetch(url);
if (!res.ok) {
  console.error(
    `Error: failed to fetch OpenAPI spec from ${url}: ${res.status}`
  );
  process.exit(1);
}
const specText = await res.text();
const specPath = 'scripts/ai-qa/openapi-spec.json';
writeFileSync(specPath, JSON.stringify(JSON.parse(specText), null, 2) + '\n');

execSync(`openapi-typescript "${specPath}" -o src/types/api.ts`, {
  stdio: 'inherit',
});
