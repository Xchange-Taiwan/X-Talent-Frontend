import { appendFileSync } from 'node:fs';

export function encodeContext(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64');
}

export function decodeContext(b64) {
  if (!b64) return null;
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
}

/** Writes `name=value` to $GITHUB_OUTPUT so downstream jobs can read it via `needs.<job>.outputs.<name>`. */
export function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error(
      'GITHUB_OUTPUT is not set — this must run inside a GitHub Actions job'
    );
  }
  appendFileSync(outputPath, `${name}=${value}\n`);
}
