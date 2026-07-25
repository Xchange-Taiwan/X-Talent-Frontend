// Thin wrapper around @playwright/mcp's in-process API. createConnection()
// returns an MCP Server object directly importable in this same process — no
// need to spawn `npx @playwright/mcp` as a subprocess and hand-roll stdio
// JSON-RPC framing, an official in-memory transport pair does the wiring.
//
// Deliberately does NOT pass a custom `contextGetter`: @playwright/mcp
// bundles its own pinned playwright-core build internally, and a
// BrowserContext created with this repo's @playwright/test (a different
// playwright-core version) fails inside the bundled tools (confirmed via a
// throwaway smoke test — `page.ariaSnapshot is not a function`). Letting
// createConnection() manage its own browser avoids the version mismatch;
// role-fixture cookies are injected afterwards via the browser_run_code_unsafe
// tool instead (see auth-fixtures.mjs / injectCookies below).
import { createConnection } from '@playwright/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export class McpToolError extends Error {}

/** One browser session per QA scenario — cheap enough (headless chromium
 * launch is ~1-2s) and buys full isolation (fresh cookies/localStorage) per
 * scenario without having to reason about resetting a shared session.
 *
 * `isolated: true` keeps the profile in memory instead of writing it to a
 * shared user-data-dir on disk — without it, @playwright/mcp defaults to a
 * persistent on-disk profile, and a prior session that didn't exit cleanly
 * (crash, killed process) can leave a stale lock file that makes the next
 * `openSession()` fail with "Browser is already in use" even though nothing
 * is actually still running (confirmed empirically). Since every session
 * here is meant to be short-lived and independent anyway, there's nothing
 * worth persisting across launches. */
export async function openSession({ headless = true, viewport } = {}) {
  const server = await createConnection({
    browser: {
      isolated: true,
      launchOptions: { headless },
      // deviceScaleFactor: 2 emulates a Retina/HiDPI display so screenshots
      // capture at 2x the CSS pixel count — combined with `scale: 'device'`
      // on the browser_take_screenshot call (see screenshots.mjs), this is
      // what actually fixes low-resolution/blurry PR screenshots; without
      // it the browser renders (and screenshots) at 1x regardless of the
      // scale option.
      ...(viewport
        ? { contextOptions: { viewport, deviceScaleFactor: 2 } }
        : {}),
    },
    capabilities: ['core', 'core-navigation'],
  });

  const client = new Client({ name: 'ai-qa-agent', version: '0.0.1' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  async function callTool(name, args = {}) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      const text =
        result.content?.find((c) => c.type === 'text')?.text ??
        'unknown MCP tool error';
      throw new McpToolError(text);
    }
    return result;
  }

  async function close() {
    await client.close().catch(() => {});
    if (typeof server.close === 'function') {
      await server.close().catch(() => {});
    }
  }

  return { callTool, close };
}

/** Runs arbitrary Playwright code in-page via browser_run_code_unsafe — the
 * only way to reach page.context().addCookies() without a custom
 * contextGetter (see module docstring above for why we don't use one). */
export async function injectCookies(session, cookies) {
  const code = `async (page) => { await page.context().addCookies(${JSON.stringify(cookies)}); }`;
  await session.callTool('browser_run_code_unsafe', { code });
}

/** Extracts the base64 PNG/JPEG payload from a browser_take_screenshot result. */
export function extractScreenshotBuffer(result) {
  const imagePart = result.content?.find((c) => c.type === 'image');
  if (!imagePart) {
    throw new McpToolError(
      'browser_take_screenshot returned no image content.'
    );
  }
  return Buffer.from(imagePart.data, 'base64');
}

/** Extracts the plain-text/YAML accessibility snapshot from a browser_snapshot
 * or browser_navigate result — this is what gets fed to the QA agent's LLM
 * turn instead of raw DOM or a screenshot on every turn. */
export function extractSnapshotText(result) {
  return result.content?.find((c) => c.type === 'text')?.text ?? '';
}
