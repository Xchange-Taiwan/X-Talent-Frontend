// @vitest-environment node
import crossSpawn from 'cross-spawn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DevServerTimeoutError,
  findFreePort,
  stopDevServer,
  waitForReady,
} from './server.mjs';

describe('findFreePort', () => {
  it('returns a valid ephemeral port number', async () => {
    const port = await findFreePort();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });

  it('can be called repeatedly without colliding (OS hands back distinct free ports)', async () => {
    const [a, b] = await Promise.all([findFreePort(), findFreePort()]);
    expect(a).not.toBe(b);
  });
});

describe('waitForReady', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('resolves as soon as the server responds at all, even with a non-2xx status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404 });
    await expect(
      waitForReady({ port: 3000, timeoutMs: 2000 })
    ).resolves.toBeUndefined();
  });

  it('throws DevServerTimeoutError when the server never responds within the budget', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(waitForReady({ port: 3000, timeoutMs: 700 })).rejects.toThrow(
      DevServerTimeoutError
    );
  }, 10_000);
});

describe('stopDevServer', () => {
  it('does not resolve until the child process has actually exited', async () => {
    const child = crossSpawn('node', ['-e', 'setTimeout(() => {}, 5000)']);
    const handle = { child, port: 0, getOutput: () => '' };

    await stopDevServer(handle);

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }, 15_000);

  it('resolves immediately for a handle whose child already exited', async () => {
    const child = crossSpawn('node', ['-e', 'process.exit(0)']);
    await new Promise((resolve) => child.once('exit', resolve));

    await expect(
      stopDevServer({ child, port: 0, getOutput: () => '' })
    ).resolves.toBeUndefined();
  });

  it('does nothing for a null handle', async () => {
    await expect(stopDevServer(null)).resolves.toBeUndefined();
  });
});
