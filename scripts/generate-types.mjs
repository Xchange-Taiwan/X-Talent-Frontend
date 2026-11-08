import { config } from 'dotenv';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

config();
config({ path: '.env.development.local', override: true });

const url = process.env.BFF_OPENAPI_URL;
if (!url) {
  console.error('Error: BFF_OPENAPI_URL is not set. Add it to your .env file.');
  process.exit(1);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(
    `Error: failed to fetch OpenAPI spec from ${url}: ${res.status}`
  );
  process.exit(1);
}
const specText = await res.text();
const specPath = join(tmpdir(), 'openapi-spec.json');
writeFileSync(specPath, JSON.stringify(JSON.parse(specText), null, 2) + '\n');

execSync(`openapi-typescript "${specPath}" -o src/types/api.ts`, {
  stdio: 'inherit',
});
