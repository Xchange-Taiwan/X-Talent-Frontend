// @vitest-environment node
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');
const { ArtifactsError, composeBeforeAfter, publishArtifacts } =
  await import('./artifacts.mjs');

function failure(message = 'command failed') {
  return Object.assign(new Error(message), { stderr: message });
}

beforeEach(() => {
  execFileSync.mockReset();
});

async function solidPng(width, height, color) {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();
}

describe('composeBeforeAfter', () => {
  it('lays out before and after side by side at their native resolution, no resizing', async () => {
    const before = await solidPng(1280, 800, { r: 255, g: 0, b: 0 });
    const after = await solidPng(1280, 800, { r: 0, g: 255, b: 0 });

    const composed = await composeBeforeAfter(before, after);
    const meta = await sharp(composed).metadata();

    // Canvas width = before.width + gap + after.width, at full native size —
    // nothing downscaled, unlike the old fixed-PANEL_WIDTH behavior.
    expect(meta.width).toBe(1280 + 16 + 1280);
    expect(meta.height).toBe(32 + 800);
    expect(meta.format).toBe('png');
  });

  it('renders a single after-only panel at native resolution when there is no before shot', async () => {
    const after = await solidPng(1280, 800, { r: 0, g: 255, b: 0 });

    const composed = await composeBeforeAfter(null, after);
    const meta = await sharp(composed).metadata();

    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(32 + 800);
    expect(meta.format).toBe('png');
  });

  it('sizes the canvas from each panel’s own dimensions when before/after differ', async () => {
    const before = await solidPng(1000, 600, { r: 10, g: 10, b: 10 });
    const after = await solidPng(700, 900, { r: 20, g: 20, b: 20 });

    const composed = await composeBeforeAfter(before, after);
    const meta = await sharp(composed).metadata();

    expect(meta.width).toBe(1000 + 16 + 700);
    expect(meta.height).toBe(32 + 900); // max(600, 900)
  });
});

describe('publishArtifacts', () => {
  const files = [
    { filename: 's1-desktop.png', buffer: Buffer.from('fake-png-bytes') },
  ];

  function mockGitAndGh({ repoExists = true } = {}) {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        if (repoExists) return '';
        throw failure('repository not found');
      }
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'create') {
        expect(args).toContain('--public');
        return '';
      }
      if (cmd === 'git' && args[0] === 'clone') return '';
      if (cmd === 'git' && args[0] === 'add') return '';
      if (cmd === 'git' && args[0] === 'commit') return '';
      if (cmd === 'git' && args[0] === 'push') return '';
      if (
        cmd === 'git' &&
        args[0] === 'branch' &&
        args[1] === '--show-current'
      ) {
        return 'main\n';
      }
      throw new Error(`unexpected call: ${cmd} ${args.join(' ')}`);
    });
  }

  it('publishes to the dedicated artifacts repo and returns raw URLs per file', async () => {
    mockGitAndGh({ repoExists: true });

    const result = await publishArtifacts({
      owner: 'Xchange-Taiwan',
      ticketNumber: 318,
      files,
    });

    expect(result).toEqual([
      {
        filename: 's1-desktop.png',
        url: 'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend-PR-Image-Public/main/318/s1-desktop.png',
      },
    ]);
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).not.toContain(expect.stringContaining('repo create'));
  });

  it('creates the dedicated repo the first time it is missing', async () => {
    mockGitAndGh({ repoExists: false });

    await publishArtifacts({
      owner: 'Xchange-Taiwan',
      ticketNumber: 318,
      files,
    });

    const calledArgs = execFileSync.mock.calls.map(([, args]) => args);
    expect(
      calledArgs.some((args) => args[0] === 'repo' && args[1] === 'create')
    ).toBe(true);
  });

  it('throws ArtifactsError when the push fails', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') return '';
      if (cmd === 'git' && args[0] === 'clone') return '';
      if (cmd === 'git' && args[0] === 'add') return '';
      if (cmd === 'git' && args[0] === 'commit') return '';
      if (cmd === 'git' && args[0] === 'push') throw failure('rejected');
      throw new Error(`unexpected call: ${cmd} ${args.join(' ')}`);
    });

    await expect(
      publishArtifacts({ owner: 'Xchange-Taiwan', ticketNumber: 318, files })
    ).rejects.toThrow(ArtifactsError);
  });
});
