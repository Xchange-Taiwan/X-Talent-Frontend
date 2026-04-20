import { config } from 'dotenv';
import { execSync } from 'child_process';

config();
config({ path: '.env.development.local', override: true });

const url = process.env.BFF_OPENAPI_URL;
if (!url) {
  console.error('Error: BFF_OPENAPI_URL is not set. Add it to your .env file.');
  process.exit(1);
}

execSync(`openapi-typescript "${url}" -o src/types/api.ts`, {
  stdio: 'inherit',
});
