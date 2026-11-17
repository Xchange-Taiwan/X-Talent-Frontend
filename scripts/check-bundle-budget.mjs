#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const DEFAULT_BUDGETS = {
  pageSizeWarnKb: 55,
  pageSizeFailKb: 90,
  firstLoadWarnKb: 465,
  firstLoadFailKb: 520,
  sharedBaseWarnKb: 425,
  sharedBaseFailKb: 455,
};

function normalizeChunkRelPath(chunkPath = '') {
  return String(chunkPath)
    .replace(/^\/_next\//, '')
    .replace(/^\//, '');
}

function extractRscManifestJson(rawJsContent = '', routeKey = '') {
  const lines = String(rawJsContent).split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('__RSC_MANIFEST[') || !line.includes('=')) continue;
    const eqIdx = line.indexOf('=');
    const jsonCandidate = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/;\s*$/, '');
    if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
      try {
        return JSON.parse(jsonCandidate);
      } catch {
        // Continue scanning lines if assignment format differs
      }
    }
  }
  const firstBrace = rawJsContent.indexOf('{"moduleLoading"');
  if (firstBrace >= 0) {
    const trimmed = rawJsContent.slice(firstBrace).trim().replace(/;\s*$/, '');
    return JSON.parse(trimmed);
  }
  throw new Error(`Unable to parse RSC client manifest for ${routeKey}`);
}

export function analyzeNextBundleBudget({
  nextDir = path.resolve(process.cwd(), '.next'),
  budgets = {},
} = {}) {
  const activeBudgets = {
    pageSizeWarnKb: Number(
      budgets.pageSizeWarnKb ??
        process.env.PAGE_SIZE_WARN_KB ??
        DEFAULT_BUDGETS.pageSizeWarnKb
    ),
    pageSizeFailKb: Number(
      budgets.pageSizeFailKb ??
        process.env.PAGE_SIZE_FAIL_KB ??
        DEFAULT_BUDGETS.pageSizeFailKb
    ),
    firstLoadWarnKb: Number(
      budgets.firstLoadWarnKb ??
        process.env.FIRST_LOAD_WARN_KB ??
        DEFAULT_BUDGETS.firstLoadWarnKb
    ),
    firstLoadFailKb: Number(
      budgets.firstLoadFailKb ??
        process.env.FIRST_LOAD_FAIL_KB ??
        DEFAULT_BUDGETS.firstLoadFailKb
    ),
    sharedBaseWarnKb: Number(
      budgets.sharedBaseWarnKb ??
        process.env.SHARED_BASE_WARN_KB ??
        DEFAULT_BUDGETS.sharedBaseWarnKb
    ),
    sharedBaseFailKb: Number(
      budgets.sharedBaseFailKb ??
        process.env.SHARED_BASE_FAIL_KB ??
        DEFAULT_BUDGETS.sharedBaseFailKb
    ),
  };

  const appRoutesPath = path.join(nextDir, 'app-path-routes-manifest.json');
  const buildManifestPath = path.join(nextDir, 'build-manifest.json');

  if (!fs.existsSync(appRoutesPath) || !fs.existsSync(buildManifestPath)) {
    return {
      passed: false,
      failureReason: 'missing_next_manifests',
      sharedBaseKb: 0,
      routes: [],
      violations: [],
      warnings: [],
      budgets: activeBudgets,
    };
  }

  const appRoutes = JSON.parse(fs.readFileSync(appRoutesPath, 'utf8'));
  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));

  const gzipCache = new Map();
  const getChunkGzipBytes = (chunkPath) => {
    const clean = normalizeChunkRelPath(chunkPath);
    if (!clean) return 0;
    if (gzipCache.has(clean)) return gzipCache.get(clean);
    const abs = path.join(nextDir, clean);
    if (!fs.existsSync(abs)) {
      gzipCache.set(clean, 0);
      return 0;
    }
    const gzBytes = zlib.gzipSync(fs.readFileSync(abs)).length;
    gzipCache.set(clean, gzBytes);
    return gzBytes;
  };

  const rootChunks = new Set(
    [
      ...(buildManifest.rootMainFiles || []),
      ...(buildManifest.polyfillFiles || []),
    ].map(normalizeChunkRelPath)
  );

  const pageEntries = Object.entries(appRoutes)
    .filter(([appKey]) => appKey.endsWith('/page') && !appKey.startsWith('/_'))
    .sort((a, b) => a[1].localeCompare(b[1]));

  if (pageEntries.length === 0) {
    return {
      passed: false,
      failureReason: 'zero_routes_detected',
      sharedBaseKb: 0,
      routes: [],
      violations: [],
      warnings: [],
      budgets: activeBudgets,
    };
  }

  const routes = [];
  const violations = [];
  const warnings = [];
  let minFirstLoadKb = Number.POSITIVE_INFINITY;

  for (const [appKey, publicRoute] of pageEntries) {
    const manifestRel =
      path.join('server', 'app', ...appKey.split('/').filter(Boolean)) +
      '_client-reference-manifest.js';
    const manifestAbs = path.join(nextDir, manifestRel);

    const allRouteChunks = new Set(rootChunks);
    const pageExclusiveChunks = new Set();

    if (fs.existsSync(manifestAbs)) {
      const rsc = extractRscManifestJson(
        fs.readFileSync(manifestAbs, 'utf8'),
        appKey
      );
      const entryFiles = rsc?.entryJSFiles || {};
      const pageEntryKey =
        Object.keys(entryFiles).find((k) => k.endsWith('/page')) || '';

      for (const [entryKey, chunks] of Object.entries(entryFiles)) {
        for (const rawChunk of chunks || []) {
          const clean = normalizeChunkRelPath(rawChunk);
          if (!clean.endsWith('.js')) continue;
          allRouteChunks.add(clean);
          if (entryKey === pageEntryKey && !rootChunks.has(clean)) {
            pageExclusiveChunks.add(clean);
          }
        }
      }

      for (const [entryKey, chunks] of Object.entries(entryFiles)) {
        if (entryKey === pageEntryKey) continue;
        for (const rawChunk of chunks || []) {
          pageExclusiveChunks.delete(normalizeChunkRelPath(rawChunk));
        }
      }
    }

    let firstLoadBytes = 0;
    for (const ch of allRouteChunks) firstLoadBytes += getChunkGzipBytes(ch);

    let pageExclusiveBytes = 0;
    for (const ch of pageExclusiveChunks) {
      pageExclusiveBytes += getChunkGzipBytes(ch);
    }

    const sizeKb = Math.round((pageExclusiveBytes / 1024) * 10) / 10;
    const firstLoadKb = Math.round((firstLoadBytes / 1024) * 10) / 10;
    if (firstLoadKb < minFirstLoadKb) minFirstLoadKb = firstLoadKb;

    let status = 'pass';
    if (
      sizeKb >= activeBudgets.pageSizeFailKb ||
      firstLoadKb >= activeBudgets.firstLoadFailKb
    ) {
      status = 'fail';
      violations.push({
        path: publicRoute,
        size_kb: sizeKb,
        first_load_kb: firstLoadKb,
      });
    } else if (
      sizeKb >= activeBudgets.pageSizeWarnKb ||
      firstLoadKb >= activeBudgets.firstLoadWarnKb
    ) {
      status = 'warn';
      warnings.push({
        path: publicRoute,
        size_kb: sizeKb,
        first_load_kb: firstLoadKb,
      });
    }

    routes.push({
      path: publicRoute,
      size_kb: sizeKb,
      first_load_kb: firstLoadKb,
      status,
    });
  }

  const sharedBaseKb = Number.isFinite(minFirstLoadKb) ? minFirstLoadKb : 0;
  const sharedBaseExceeded = sharedBaseKb >= activeBudgets.sharedBaseFailKb;
  if (sharedBaseExceeded) {
    violations.push({
      path: '[shared-root-layout]',
      size_kb: sharedBaseKb,
      first_load_kb: sharedBaseKb,
    });
  }

  return {
    passed: routes.length > 0 && violations.length === 0,
    failureReason: violations.length > 0 ? 'budget_exceeded' : null,
    sharedBaseKb,
    routes,
    violations,
    warnings,
    budgets: activeBudgets,
  };
}

export function formatBundleBudgetMarkdown(report) {
  const b = report.budgets;
  const statusLabel = (s) =>
    s === 'fail' ? 'FAIL' : s === 'warn' ? 'WARN' : 'PASS';

  const headline = report.passed
    ? `PASS: All ${report.routes.length} routes within gzip budget${
        report.warnings.length ? ` (${report.warnings.length} warning(s))` : ''
      }`
    : report.failureReason === 'zero_routes_detected'
      ? 'FAIL: Zero App Router pages detected in .next manifests'
      : `FAIL: ${report.violations.length} budget violation(s) detected`;

  const rows = report.routes.map(
    (r) =>
      `| ${statusLabel(r.status)} | \`${r.path}\` | ${r.size_kb.toFixed(
        1
      )} kB | ${r.first_load_kb.toFixed(1)} kB |`
  );

  return [
    '## Bundle Size Budget (Next.js 16 Gzip Chunks)',
    '',
    `**${headline}**`,
    '',
    `- **Shared Root + Layout JS (gzip)**: \`${report.sharedBaseKb.toFixed(1)} kB\` (warn >${b.sharedBaseWarnKb} kB / fail >${b.sharedBaseFailKb} kB)`,
    `- **Route-Exclusive JS (gzip)**: warn >${b.pageSizeWarnKb} kB / fail >${b.pageSizeFailKb} kB`,
    `- **Total First Load JS (gzip)**: warn >${b.firstLoadWarnKb} kB / fail >${b.firstLoadFailKb} kB`,
    '',
    '| Status | Route | Route-Exclusive JS | First Load JS |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function main() {
  const outFile = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : '.bundle-report.json';
  const mdOutFile = process.argv.includes('--md-out')
    ? process.argv[process.argv.indexOf('--md-out') + 1]
    : '';

  const report = analyzeNextBundleBudget();
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

  const md = formatBundleBudgetMarkdown(report);
  if (mdOutFile) {
    fs.writeFileSync(mdOutFile, `${md}\n`, 'utf8');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`, 'utf8');
  }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `passed=${report.passed ? 'true' : 'false'}\nviolations=${report.violations.length}\nroutes=${report.routes.length}\n`,
      'utf8'
    );
  }

  console.log(md);
  if (!report.passed) {
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
