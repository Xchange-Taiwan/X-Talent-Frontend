// Screenshot capture helpers built on top of mcp-client.mjs. Kept separate
// from qa-agent.mjs (which drives *interactive* scenarios) — these are all
// either "screenshot whatever the interactive session ended on" or
// "navigate-only, no interaction", never their own tool-calling loop.
import {
  extractScreenshotBuffer,
  injectCookies,
  openSession,
} from './mcp-client.mjs';

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Screenshots whatever the given (already-navigated, already-interacted-with)
 * MCP session is currently showing — used right after a scenario finishes. */
export async function captureSessionScreenshot(session) {
  const result = await session.callTool('browser_take_screenshot', {
    type: 'png',
    // 'device' captures at the context's deviceScaleFactor (set to 2 in
    // mcp-client.mjs) instead of 1x CSS pixels — the combination is what
    // actually produces sharp, non-blurry screenshots.
    scale: 'device',
  });
  return extractScreenshotBuffer(result);
}

/**
 * Checks whether a route responds with something other than 404 before
 * bothering to spin up a browser for it. Used by the base-ref "before" shot:
 * a brand-new page this ticket introduces won't exist on the base branch,
 * and that's expected, not an error (see qa-bridge.mjs's `Feature Not In
 * Base` handling).
 */
export async function routeExists({ baseUrl, route }) {
  try {
    const res = await fetch(`${baseUrl}${route}`, {
      signal: AbortSignal.timeout(10_000),
    });
    return res.status !== 404;
  } catch {
    return false;
  }
}

/**
 * Opens a fresh, isolated session, navigates to `route` (no interaction —
 * this must work identically on the base-ref worktree, which doesn't have
 * whatever new elements the ticket introduces), resizes to `viewport`, and
 * screenshots. `cookies` lets the caller apply a role fixture before
 * navigating (see auth-fixtures.mjs); omit for an anonymous/visitor view.
 */
export async function captureRouteScreenshot({
  baseUrl,
  route,
  viewport,
  cookies,
}) {
  const session = await openSession({ headless: true, viewport });
  try {
    if (cookies?.length) {
      await injectCookies(session, cookies);
    }
    await session.callTool('browser_navigate', { url: `${baseUrl}${route}` });
    return await captureSessionScreenshot(session);
  } finally {
    await session.close();
  }
}
