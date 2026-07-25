// Top-level QA orchestration — shape mirrors scripts/ai-dev/lib/review-bridge.mjs's
// reviewDiff(): one exported entry point (runQa) that the ai:dev orchestrator
// calls once per iteration, returning a status + findings + a ready-to-post
// PR report.
import { parseOwnerRepo, remoteOriginUrl } from '../../ai-dev/lib/git.mjs';
import { mintSessionCookies } from './auth-fixtures.mjs';
import { composeBeforeAfter, publishArtifacts } from './artifacts.mjs';
import { planFixtures } from './fixture-planner.mjs';
import { injectCookies, openSession } from './mcp-client.mjs';
import { startMockApiServer } from './mock-api-server.mjs';
import { runScenario } from './qa-agent.mjs';
import { planScenarios } from './scenario-planner.mjs';
import {
  captureRouteScreenshot,
  captureSessionScreenshot,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  routeExists,
} from './screenshots.mjs';
import {
  DevServerTimeoutError,
  findFreePort,
  startDevServer,
  stopDevServer,
  waitForReady,
} from './server.mjs';
import { withBaseWorktree } from './worktree.mjs';

// Before-shots only need to be captured once per `ai:dev` process run, not
// once per retry iteration (the pre-ticket page doesn't change between
// retries) — keyed by `${baseRef}::${route}`, cleared only when the process
// exits.
const beforeShotCache = new Map();

function emptyResult(status, reason) {
  return { status, reason, scenarios: [], findings: [], reportMarkdown: null };
}

async function runOneScenario({
  scenario,
  baseUrl,
  apiBaseUrl,
  useRealBackend,
}) {
  let cookies;
  try {
    cookies = await mintSessionCookies({
      role: scenario.role,
      apiBaseUrl,
      useRealBackend,
    });
  } catch (err) {
    return {
      scenario,
      status: 'infra-error',
      reason: `角色 fixture 準備失敗：${err.message}`,
      afterDesktopShot: null,
      afterMobileShot: null,
    };
  }

  let interactive;
  let afterDesktopShot = null;
  const session = await openSession({
    headless: true,
    viewport: DESKTOP_VIEWPORT,
  });
  try {
    if (cookies.length) await injectCookies(session, cookies);
    interactive = await runScenario({ session, scenario, baseUrl });
    afterDesktopShot = await captureSessionScreenshot(session).catch(
      () => null
    );
  } catch (err) {
    // Anything unexpected here (MCP session crash, etc.) is a harness
    // problem, not a proven functional bug — same "don't blame the dev
    // agent's code for our own infra hiccups" rule as everywhere else.
    interactive = {
      status: 'infra-error',
      reason: `情境執行異常：${err.message}`,
    };
  } finally {
    await session.close().catch(() => {});
  }

  const afterMobileShot = await captureRouteScreenshot({
    baseUrl,
    route: scenario.route,
    viewport: MOBILE_VIEWPORT,
    cookies,
  }).catch(() => null);

  return { scenario, ...interactive, afterDesktopShot, afterMobileShot };
}

/** Fetches (or reuses the cached) navigate-only "before" screenshot for each
 * unique route among this run's scenarios. A base-ref dev server that fails
 * to boot just means no before-shots this time — it must never fail the
 * whole QA run. */
async function getBeforeShots(baseRef, routes, devServerEnv) {
  const missing = routes.filter(
    (r) => !beforeShotCache.has(`${baseRef}::${r}`)
  );
  if (missing.length > 0) {
    await withBaseWorktree(baseRef, async (worktreeDir) => {
      let handle;
      try {
        const port = await findFreePort();
        handle = startDevServer({ cwd: worktreeDir, port, env: devServerEnv });
        await waitForReady({ port });
        const baseUrl = `http://localhost:${port}`;
        for (const route of missing) {
          const exists = await routeExists({ baseUrl, route });
          const shot = exists
            ? await captureRouteScreenshot({
                baseUrl,
                route,
                viewport: DESKTOP_VIEWPORT,
              }).catch(() => null)
            : null;
          beforeShotCache.set(`${baseRef}::${route}`, shot);
        }
      } catch (err) {
        console.warn(
          `[ai-qa] base-ref dev server unavailable, skipping before-shots: ${err.message}`
        );
        for (const route of missing)
          beforeShotCache.set(`${baseRef}::${route}`, null);
      } finally {
        await stopDevServer(handle);
      }
    });
  }
  return new Map(
    routes.map((r) => [r, beforeShotCache.get(`${baseRef}::${r}`) ?? null])
  );
}

export function aggregateStatus(results) {
  if (results.some((r) => r.status === 'failed')) return 'failed';
  if (results.some((r) => r.status === 'infra-error')) return 'infra-error';
  return 'passed';
}

export function buildFindings(results) {
  return results
    .filter((r) => r.status === 'failed')
    .map((r) => ({
      file: r.scenario.route,
      category: 'Functional QA',
      issue: `[${r.scenario.role}] ${r.scenario.description} — 預期：${r.scenario.expected}`,
      why: r.reason || '（無說明）',
      fix: '請根據上面的失敗原因修正對應功能，修正後會再跑一次 QA 驗證。',
      source: '🧪 QA Agent',
    }));
}

const STATUS_EMOJI = { passed: '✅', failed: '❌', 'infra-error': '⚠️' };

export function buildReportMarkdown({
  ticket,
  results,
  artifactsByScenario,
  artifactsPublished,
}) {
  const lines = [
    '## 🧪 QA Agent 測試報告',
    '',
    `依 ticket #${ticket.number}「${ticket.title}」規劃出 ${results.length} 個情境並實際操作驗證：`,
    '',
    '| 角色 | 操作內容 | 預期結果 | 結果 |',
    '| --- | --- | --- | --- |',
    ...results.map((r) => {
      const emoji = STATUS_EMOJI[r.status] ?? '⚠️';
      const note = r.reason ? `${emoji} ${r.reason}` : emoji;
      return `| ${r.scenario.role} | ${r.scenario.description} | ${r.scenario.expected} | ${note} |`;
    }),
  ];

  if (artifactsPublished) {
    lines.push('', '### 畫面截圖', '');
    for (const r of results) {
      const art = artifactsByScenario.get(r.scenario.id);
      if (!art) continue;
      lines.push(`**${r.scenario.id}**（${r.scenario.role}）`, '');
      if (art.desktopUrl)
        lines.push(
          `![${r.scenario.id}-desktop 改動前後對照](${art.desktopUrl})`,
          ''
        );
      if (art.mobileUrl)
        lines.push(`![${r.scenario.id}-mobile 手機畫面](${art.mobileUrl})`, '');
    }
  } else {
    lines.push('', '_（截圖上傳失敗，本次僅顯示文字報告）_');
  }

  return lines.join('\n');
}

/**
 * Runs the QA stage for the current diff against `baseRef`. Returns
 * `{ status, reason, scenarios, findings, reportMarkdown }` where `status` is
 * one of 'not-applicable' | 'passed' | 'failed' | 'infra-error'.
 *
 * By default scenarios never touch the real backend: a standalone mock API
 * server (mock-api-server.mjs) is started per run, seeded with a baseline
 * login handler plus whatever the fixture planner drafts for this ticket,
 * and NEXT_PUBLIC_API_URL is pointed at it for both the head dev server and
 * the base-ref "before" dev server. Set QA_USE_REAL_BACKEND=1 to opt out
 * and hit whatever NEXT_PUBLIC_API_URL already points to instead (paired
 * with real QA_TEST_ACCOUNT_* credentials in auth-fixtures.mjs).
 */
export async function runQa({ ticket, baseRef }) {
  const [plan, fixtures] = await Promise.all([
    planScenarios({ ticket, baseRef }),
    planFixtures({ ticket, baseRef }),
  ]);
  if (!plan.applicable) {
    return emptyResult('not-applicable', plan.reason);
  }

  const useRealBackend = process.env.QA_USE_REAL_BACKEND === '1';
  const mock = useRealBackend ? null : await startMockApiServer();
  if (mock) {
    for (const fixture of fixtures) {
      mock.registerHandler(fixture.method, fixture.path, async () => ({
        status: fixture.status,
        body: fixture.body,
      }));
    }
  }
  const apiBaseUrl = mock ? mock.url : process.env.NEXT_PUBLIC_API_URL;
  const devServerEnv = mock ? { NEXT_PUBLIC_API_URL: apiBaseUrl } : {};

  try {
    let headHandle;
    let results;
    try {
      const port = await findFreePort();
      headHandle = startDevServer({
        cwd: process.cwd(),
        port,
        env: devServerEnv,
      });
      await waitForReady({ port });
      const baseUrl = `http://localhost:${port}`;

      results = [];
      for (const scenario of plan.scenarios) {
        results.push(
          await runOneScenario({
            scenario,
            baseUrl,
            apiBaseUrl,
            useRealBackend,
          })
        );
      }
    } catch (err) {
      const reason =
        err instanceof DevServerTimeoutError
          ? err.message
          : `QA dev server 啟動失敗：${err.message}`;
      return emptyResult('infra-error', reason);
    } finally {
      await stopDevServer(headHandle);
    }

    const uniqueRoutes = [...new Set(plan.scenarios.map((s) => s.route))];
    const beforeShots = await getBeforeShots(
      baseRef,
      uniqueRoutes,
      devServerEnv
    );

    return await buildQaResult({ ticket, results, beforeShots });
  } finally {
    if (mock) await mock.stop();
  }
}

async function buildQaResult({ ticket, results, beforeShots }) {
  const artifactsByScenario = new Map();
  let artifactsPublished = false;
  try {
    const files = [];
    for (const r of results) {
      if (r.afterDesktopShot) {
        const composed = await composeBeforeAfter(
          beforeShots.get(r.scenario.route),
          r.afterDesktopShot
        );
        files.push({
          filename: `${r.scenario.id}-desktop.png`,
          buffer: composed,
          scenarioId: r.scenario.id,
          kind: 'desktopUrl',
        });
      }
      if (r.afterMobileShot) {
        files.push({
          filename: `${r.scenario.id}-mobile.png`,
          buffer: r.afterMobileShot,
          scenarioId: r.scenario.id,
          kind: 'mobileUrl',
        });
      }
    }

    if (files.length > 0) {
      const { owner } = parseOwnerRepo(remoteOriginUrl());
      const published = await publishArtifacts({
        owner,
        ticketNumber: ticket.number,
        files,
      });
      for (const file of files) {
        const url = published.find((p) => p.filename === file.filename)?.url;
        const entry = artifactsByScenario.get(file.scenarioId) ?? {};
        entry[file.kind] = url;
        artifactsByScenario.set(file.scenarioId, entry);
      }
      artifactsPublished = true;
    }
  } catch (err) {
    // Non-blocking by design (see issue #318: image upload failure must
    // degrade to a text-only report, not fail the QA gate).
    console.warn(
      `[ai-qa] publishing artifacts failed, falling back to text-only report: ${err.message}`
    );
  }

  return {
    status: aggregateStatus(results),
    reason: null,
    scenarios: results.map((r) => ({
      id: r.scenario.id,
      role: r.scenario.role,
      status: r.status,
      reason: r.reason,
    })),
    findings: buildFindings(results),
    reportMarkdown: buildReportMarkdown({
      ticket,
      results,
      artifactsByScenario,
      artifactsPublished,
    }),
  };
}
