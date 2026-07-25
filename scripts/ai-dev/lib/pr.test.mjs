// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');
const {
  PrError,
  buildCommitSubject,
  buildPrBody,
  commentOnPr,
  findOpenPrForBranch,
  createPr,
} = await import('./pr.mjs');

function failure(message = 'command failed') {
  return Object.assign(new Error(message), { stderr: message });
}

function mockGh(responses) {
  execFileSync.mockImplementation((_cmd, args) => {
    const key = args.join(' ');
    if (!(key in responses)) {
      throw new Error(`unexpected gh invocation in test: gh ${key}`);
    }
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  });
}

beforeEach(() => {
  execFileSync.mockReset();
});

describe('buildCommitSubject', () => {
  it('strips leading bracket tags and a ticket number prefix', () => {
    expect(
      buildCommitSubject({
        number: 312,
        title: '[Feature][FE] #312 — ai:dev: auto create PR',
      })
    ).toBe('feat: ai:dev: auto create PR');
  });

  it('falls back to the raw title when there is no bracket/number prefix', () => {
    expect(buildCommitSubject({ number: 1, title: 'add dark mode' })).toBe(
      'feat: add dark mode'
    );
  });
});

describe('buildPrBody', () => {
  it('links back to the tracker issue', () => {
    const body = buildPrBody({ number: 312, title: 'anything' });
    expect(body).toContain('Closes Xchange-Taiwan/X-Talent-Tracker#312');
  });
});

describe('findOpenPrForBranch', () => {
  it('returns the URL of an existing open PR', () => {
    mockGh({
      'pr list --head feat/x --state open --json url':
        '[{"url":"https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/9"}]',
    });
    expect(findOpenPrForBranch('feat/x')).toBe(
      'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/9'
    );
  });

  it('returns null when no open PR exists', () => {
    mockGh({ 'pr list --head feat/x --state open --json url': '[]' });
    expect(findOpenPrForBranch('feat/x')).toBeNull();
  });

  it('throws PrError when the gh call fails', () => {
    mockGh({
      'pr list --head feat/x --state open --json url':
        failure('not authenticated'),
    });
    expect(() => findOpenPrForBranch('feat/x')).toThrow(PrError);
  });
});

describe('createPr', () => {
  it('creates a PR against develop and returns the URL', () => {
    mockGh({
      'pr create --base develop --head feat/x --title feat: thing --body body text':
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/10\n',
    });
    const url = createPr({
      branch: 'feat/x',
      title: 'feat: thing',
      body: 'body text',
    });
    expect(url).toBe(
      'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/10'
    );
  });

  it('throws PrError when the gh call fails', () => {
    mockGh({
      'pr create --base develop --head feat/x --title feat: thing --body body text':
        failure('a pull request for branch "feat/x" already exists'),
    });
    expect(() =>
      createPr({ branch: 'feat/x', title: 'feat: thing', body: 'body text' })
    ).toThrow(PrError);
  });
});

describe('commentOnPr', () => {
  it("posts a comment to the branch's PR", () => {
    mockGh({ 'pr comment feat/x --body report text': '' });
    expect(() =>
      commentOnPr({ branch: 'feat/x', body: 'report text' })
    ).not.toThrow();
  });

  it('throws PrError when the gh call fails', () => {
    mockGh({
      'pr comment feat/x --body report text': failure('no such PR'),
    });
    expect(() =>
      commentOnPr({ branch: 'feat/x', body: 'report text' })
    ).toThrow(PrError);
  });
});
