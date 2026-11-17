#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Upstream-blocked or dev-only major-boundary High advisories that currently
 * have no non-breaking semver patch in upstream ecosystems:
 * - picomatch (<=4.0.7 inside @sentry/nextjs -> @rollup/pluginutils): patched_versions = "<0.0.0" (no upstream fix published yet)
 * - zod (<4.6.6): project uses zod v3 (^3.22.4) across react-hook-form schemas; v4 is a breaking major migration
 * - webpack-dev-middleware (<7.4.6 inside @storybook/builder-webpack5): dev-only local Storybook builder dependency
 */
export const DEFAULT_ALLOWED_HIGH_MODULES = new Set([
  'picomatch',
  'zod',
  'webpack-dev-middleware',
]);

export function evaluatePnpmAuditJson(
  rawJsonText,
  { allowedHighModules = DEFAULT_ALLOWED_HIGH_MODULES } = {}
) {
  const trimmed = String(rawJsonText ?? '').trim();
  if (!trimmed) {
    return {
      passed: false,
      reason: 'invalid_audit_json',
      criticalCount: 0,
      highCount: 0,
      totalCount: 0,
      blockingCritical: [],
      blockingHigh: [],
      waivedHigh: [],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      passed: false,
      reason: 'invalid_audit_json',
      criticalCount: 0,
      highCount: 0,
      totalCount: 0,
      blockingCritical: [],
      blockingHigh: [],
      waivedHigh: [],
    };
  }

  const vulnCounts = parsed?.metadata?.vulnerabilities;
  if (!vulnCounts || typeof vulnCounts !== 'object') {
    return {
      passed: false,
      reason: 'missing_vulnerability_metadata',
      criticalCount: 0,
      highCount: 0,
      totalCount: 0,
      blockingCritical: [],
      blockingHigh: [],
      waivedHigh: [],
    };
  }

  const advisories = Object.values(parsed.advisories || {});
  const blockingCritical = [];
  const blockingHigh = [];
  const waivedHigh = [];

  for (const adv of advisories) {
    const severity = String(adv?.severity || '').toLowerCase();
    const entry = {
      id: adv?.github_advisory_id || String(adv?.id || 'unknown'),
      module: String(adv?.module_name || 'unknown'),
      severity,
      patchedVersions: String(adv?.patched_versions || ''),
      title: String(adv?.title || ''),
      samplePath: adv?.findings?.[0]?.paths?.[0] || '',
    };

    if (severity === 'critical') {
      blockingCritical.push(entry);
    } else if (severity === 'high') {
      if (allowedHighModules.has(entry.module)) {
        waivedHigh.push(entry);
      } else {
        blockingHigh.push(entry);
      }
    }
  }

  const criticalCount = Number(vulnCounts.critical ?? blockingCritical.length);
  const highCount = Number(
    vulnCounts.high ?? blockingHigh.length + waivedHigh.length
  );
  const totalCount =
    Number(vulnCounts.total) ||
    Number(vulnCounts.info || 0) +
      Number(vulnCounts.low || 0) +
      Number(vulnCounts.moderate || 0) +
      highCount +
      criticalCount;

  const hasBlocking =
    criticalCount > 0 || blockingCritical.length > 0 || blockingHigh.length > 0;

  return {
    passed: !hasBlocking,
    reason: hasBlocking ? 'blocking_vulnerabilities_found' : 'ok',
    criticalCount,
    highCount,
    totalCount,
    blockingCritical,
    blockingHigh,
    waivedHigh,
  };
}

function writeGithubOutput(values) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  fs.appendFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const proc = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 25 * 1024 * 1024,
  });

  if (proc.stderr && proc.stderr.trim()) {
    console.error('[pnpm audit stderr]', proc.stderr.trim());
  }

  const report = evaluatePnpmAuditJson(proc.stdout || '');
  writeGithubOutput({
    result: report.passed ? 'passed' : 'failed',
    critical: String(report.criticalCount),
    high: String(report.highCount),
    blocking_high: String(report.blockingHigh.length),
    waived_high: String(report.waivedHigh.length),
    total: String(report.totalCount),
  });

  if (!report.passed) {
    console.error(
      `Security audit failed (${report.reason}): critical=${report.criticalCount}, blockingHigh=${report.blockingHigh.length}`
    );
    for (const item of [...report.blockingCritical, ...report.blockingHigh]) {
      console.error(
        `  - [${item.severity.toUpperCase()}] ${item.module} (${item.id}) patched=${item.patchedVersions} path=${item.samplePath}`
      );
    }
    process.exit(1);
  }

  console.log(
    `Security audit passed: critical=0, blockingHigh=0, waivedHigh=${report.waivedHigh.length}, total=${report.totalCount}`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
