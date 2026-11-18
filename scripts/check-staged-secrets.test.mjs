// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  redactSecretPreview,
  scanTextForSecrets,
  shouldSkipSecretScanPath,
} from './check-staged-secrets.mjs';

describe('scripts/check-staged-secrets', () => {
  it('detects GitHub PATs, AWS keys, PEM private keys, Google API keys, and Sentry auth tokens while redacting secret values', () => {
    const fakeGhp = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const fakeAws = 'AKIA' + 'IOSFODNN7EXAMPLE';
    const fakePem = [
      '-----BEGIN RSA ' + 'PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA',
    ].join('\n');
    const fakeSentry =
      'sntrys_' + 'eyJpYXQiOjE3MDAwMDAwMDB9_secretSignature123456';
    const fakeJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphY2sifQ.' +
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const sample = [
      `const token = "${fakeGhp}";`,
      `const aws = "${fakeAws}";`,
      fakePem,
      `SENTRY_AUTH_TOKEN=${fakeSentry}`,
      `const jwt = "${fakeJwt}";`,
    ].join('\n');

    const findings = scanTextForSecrets(sample, 'src/config.ts');
    expect(findings.length).toBeGreaterThanOrEqual(5);
    const rules = findings.map((f) => f.ruleId);
    expect(rules).toContain('github-pat');
    expect(rules).toContain('aws-access-key');
    expect(rules).toContain('private-key-pem');
    expect(rules).toContain('sentry-auth-token');
    expect(rules).toContain('jwt-token');

    for (const finding of findings) {
      expect(finding.redactedMatch).not.toContain(fakeGhp);
      expect(finding.redactedMatch).not.toContain(fakeSentry);
      expect(finding.redactedMatch).not.toContain(fakeJwt);
    }
  });

  it('skips lockfiles, .env.example, and test files where synthetic tokens may appear', () => {
    expect(shouldSkipSecretScanPath('pnpm-lock.yaml')).toBe(true);
    expect(shouldSkipSecretScanPath('.env.example')).toBe(true);
    expect(
      shouldSkipSecretScanPath('scripts/check-staged-secrets.test.mjs')
    ).toBe(true);
    expect(shouldSkipSecretScanPath('src/lib/auth.test.ts')).toBe(true);
    expect(shouldSkipSecretScanPath('src/lib/apiClient.ts')).toBe(false);
    expect(
      redactSecretPreview('ghp_' + '1234567890abcdef1234567890abcdef1234')
    ).toBe('ghp_***REDACTED***');
  });
});
