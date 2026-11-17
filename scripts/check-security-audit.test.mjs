// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { evaluatePnpmAuditJson } from './check-security-audit.mjs';

describe('scripts/check-security-audit', () => {
  it('fails closed when audit output is empty, corrupted by stderr warnings, or missing metadata', () => {
    expect(evaluatePnpmAuditJson('')).toMatchObject({
      passed: false,
      reason: 'invalid_audit_json',
    });

    expect(
      evaluatePnpmAuditJson('WARN registry timeout\n{"broken": true}')
    ).toMatchObject({
      passed: false,
      reason: 'invalid_audit_json',
    });

    expect(evaluatePnpmAuditJson('{"advisories":{}}')).toMatchObject({
      passed: false,
      reason: 'missing_vulnerability_metadata',
    });
  });

  it('blocks any critical vulnerability unconditionally', () => {
    const payload = JSON.stringify({
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 0,
          critical: 1,
          total: 1,
        },
      },
      advisories: {
        1001: {
          id: 1001,
          severity: 'critical',
          module_name: 'next',
          github_advisory_id: 'GHSA-xxxx-yyyy-zzzz',
          title: 'RCE in Next',
          patched_versions: '>=16.4.2',
          findings: [{ paths: ['. > next@16.4.1'] }],
        },
      },
    });

    const res = evaluatePnpmAuditJson(payload);
    expect(res.passed).toBe(false);
    expect(res.blockingCritical).toHaveLength(1);
  });

  it('blocks unallowlisted high vulnerabilities while permitting documented upstream-unpatched advisories', () => {
    const blockedPayload = JSON.stringify({
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 1,
          critical: 0,
          total: 1,
        },
      },
      advisories: {
        2001: {
          id: 2001,
          severity: 'high',
          module_name: 'sharp',
          github_advisory_id: 'GHSA-sharp-test-0001',
          title: 'Patchable high vuln in sharp',
          patched_versions: '>=0.35.5',
          findings: [{ paths: ['. > sharp@0.35.3'] }],
        },
      },
    });
    const blocked = evaluatePnpmAuditJson(blockedPayload);
    expect(blocked.passed).toBe(false);
    expect(blocked.blockingHigh).toHaveLength(1);

    const allowedPayload = JSON.stringify({
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 1,
          critical: 0,
          total: 1,
        },
      },
      advisories: {
        2002: {
          id: 2002,
          severity: 'high',
          module_name: 'picomatch',
          github_advisory_id: 'GHSA-pico-unpatched',
          title: 'Unpatched upstream picomatch advisory',
          patched_versions: '<0.0.0',
          findings: [
            { paths: ['. > @sentry/nextjs@10.78.0 > picomatch@4.0.7'] },
          ],
        },
      },
    });
    const allowed = evaluatePnpmAuditJson(allowedPayload, {
      allowedHighModules: new Set(['picomatch']),
    });
    expect(allowed.passed).toBe(true);
    expect(allowed.blockingHigh).toHaveLength(0);
    expect(allowed.waivedHigh).toHaveLength(1);
  });
});
