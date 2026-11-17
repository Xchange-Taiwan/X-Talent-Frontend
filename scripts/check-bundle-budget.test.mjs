// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  analyzeNextBundleBudget,
  formatBundleBudgetMarkdown,
} from './check-bundle-budget.mjs';

describe('scripts/check-bundle-budget', () => {
  it('fails closed when zero page routes are detected instead of passing vacuously', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-empty-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'app-path-routes-manifest.json'),
        JSON.stringify({ '/api/health/route': '/api/health' })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'build-manifest.json'),
        JSON.stringify({ rootMainFiles: [], polyfillFiles: [] })
      );

      const report = analyzeNextBundleBudget({ nextDir: tmpDir });
      expect(report.passed).toBe(false);
      expect(report.failureReason).toBe('zero_routes_detected');
      expect(report.routes).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails closed when .next manifests are missing and handles server-only pages plus sharedBaseFailKb violations', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-missing-'));
    try {
      const missingReport = analyzeNextBundleBudget({ nextDir: emptyDir });
      expect(missingReport.passed).toBe(false);
      expect(missingReport.failureReason).toBe('missing_next_manifests');

      const chunksDir = path.join(emptyDir, 'static', 'chunks');
      fs.mkdirSync(chunksDir, { recursive: true });
      fs.writeFileSync(
        path.join(chunksDir, 'root.js'),
        crypto.randomBytes(60 * 1024)
      );
      fs.writeFileSync(
        path.join(emptyDir, 'app-path-routes-manifest.json'),
        JSON.stringify({ '/terms/page': '/terms' })
      );
      fs.writeFileSync(
        path.join(emptyDir, 'build-manifest.json'),
        JSON.stringify({
          rootMainFiles: ['static/chunks/root.js'],
          polyfillFiles: [],
        })
      );

      const serverOnlyReport = analyzeNextBundleBudget({
        nextDir: emptyDir,
        budgets: {
          pageSizeWarnKb: 20,
          pageSizeFailKb: 40,
          firstLoadWarnKb: 100,
          firstLoadFailKb: 200,
          sharedBaseWarnKb: 30,
          sharedBaseFailKb: 50,
        },
      });
      expect(serverOnlyReport.routes).toHaveLength(1);
      expect(serverOnlyReport.routes[0].size_kb).toBe(0);
      expect(serverOnlyReport.passed).toBe(false);
      expect(serverOnlyReport.violations.map((v) => v.path)).toContain(
        '[shared-root-layout]'
      );
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('computes shared base, page-exclusive, and first-load gzip sizes from Next.js 16 manifests and flags budget violations', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-next16-'));
    try {
      const chunksDir = path.join(tmpDir, 'static', 'chunks');
      const homeDir = path.join(tmpDir, 'server', 'app', '(landing)');
      const bloatedDir = path.join(tmpDir, 'server', 'app', 'bloated');
      fs.mkdirSync(chunksDir, { recursive: true });
      fs.mkdirSync(homeDir, { recursive: true });
      fs.mkdirSync(bloatedDir, { recursive: true });

      const makePayload = (kb) => crypto.randomBytes(kb * 1024);

      fs.writeFileSync(path.join(chunksDir, 'root.js'), makePayload(20));
      fs.writeFileSync(path.join(chunksDir, 'layout.js'), makePayload(10));
      fs.writeFileSync(path.join(chunksDir, 'home.js'), makePayload(8));
      fs.writeFileSync(path.join(chunksDir, 'bloated.js'), makePayload(120));

      fs.writeFileSync(
        path.join(tmpDir, 'app-path-routes-manifest.json'),
        JSON.stringify({
          '/(landing)/page': '/',
          '/bloated/page': '/bloated',
          '/_not-found/page': '/_not-found',
        })
      );
      fs.writeFileSync(
        path.join(tmpDir, 'build-manifest.json'),
        JSON.stringify({
          rootMainFiles: ['static/chunks/root.js'],
          polyfillFiles: [],
        })
      );

      const writeRscManifest = (filePath, key, pageChunk) => {
        const payload = {
          entryJSFiles: {
            '[project]/src/app/layout': ['/_next/static/chunks/layout.js'],
            [`[project]/src/app${key}`]: [`/_next/static/chunks/${pageChunk}`],
          },
        };
        fs.writeFileSync(
          filePath,
          `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST[${JSON.stringify(key)}] = ${JSON.stringify(payload)};\n`
        );
      };

      writeRscManifest(
        path.join(homeDir, 'page_client-reference-manifest.js'),
        '/(landing)/page',
        'home.js'
      );
      writeRscManifest(
        path.join(bloatedDir, 'page_client-reference-manifest.js'),
        '/bloated/page',
        'bloated.js'
      );

      const report = analyzeNextBundleBudget({
        nextDir: tmpDir,
        budgets: {
          pageSizeWarnKb: 30,
          pageSizeFailKb: 50,
          firstLoadWarnKb: 100,
          firstLoadFailKb: 200,
          sharedBaseWarnKb: 100,
          sharedBaseFailKb: 150,
        },
      });

      expect(report.routes).toHaveLength(2);
      expect(report.passed).toBe(false);
      expect(report.violations.map((v) => v.path)).toContain('/bloated');

      const md = formatBundleBudgetMarkdown(report);
      expect(md).toContain('Bundle Size Budget');
      expect(md).toContain('`/bloated`');
      expect(md).not.toContain('No routes detected');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
