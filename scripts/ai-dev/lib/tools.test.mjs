// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PathGuardError } from './path-guard.mjs';
import {
  BinaryFileError,
  deleteFile,
  FileTooLargeError,
  listDir,
  readFile,
  searchFiles,
  submitForReview,
  writeFile,
} from './tools.mjs';

// Deliberately NOT under scripts/ai-dev/ — that whole directory is now
// blocked by path-guard.mjs (the tool must never be able to modify its own
// implementation), so a scratch dir there would fail every test below.
const SCRATCH = '.ai-dev-test-scratch-tools';

beforeEach(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });
});

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

describe('readFile', () => {
  it('reads an existing text file', () => {
    writeFileSync(`${SCRATCH}/a.txt`, 'hello\nworld\n', 'utf-8');
    const result = readFile({ path: `${SCRATCH}/a.txt` });
    expect(result.content).toBe('hello\nworld\n');
    expect(result.truncated).toBe(false);
  });

  it('throws for a non-existent file', () => {
    expect(() => readFile({ path: `${SCRATCH}/nope.txt` })).toThrow(
      PathGuardError
    );
  });

  it('refuses to read a known binary extension without inspecting content', () => {
    writeFileSync(`${SCRATCH}/img.png`, 'not really png bytes', 'utf-8');
    expect(() => readFile({ path: `${SCRATCH}/img.png` })).toThrow(
      BinaryFileError
    );
  });

  it('refuses to read a file with an unknown extension whose content contains a null byte', () => {
    writeFileSync(`${SCRATCH}/weird.dat`, Buffer.from([0x48, 0x00, 0x49]));
    expect(() => readFile({ path: `${SCRATCH}/weird.dat` })).toThrow(
      BinaryFileError
    );
  });

  it('truncates content longer than the read cap and flags truncated:true', () => {
    const big = 'x'.repeat(25_000);
    writeFileSync(`${SCRATCH}/big.txt`, big, 'utf-8');
    const result = readFile({ path: `${SCRATCH}/big.txt` });
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThan(big.length);
  });
});

describe('writeFile — basic behavior', () => {
  it('creates a new file with the given content', () => {
    writeFile({ path: `${SCRATCH}/new.txt`, content: 'hi\n' });
    expect(readFileSync(`${SCRATCH}/new.txt`, 'utf-8')).toBe('hi\n');
  });

  it('creates intermediate directories (mkdir -p behavior)', () => {
    writeFile({ path: `${SCRATCH}/a/b/c/deep.txt`, content: 'deep\n' });
    expect(existsSync(`${SCRATCH}/a/b/c/deep.txt`)).toBe(true);
  });

  it('overwrites an existing small file', () => {
    writeFileSync(`${SCRATCH}/existing.txt`, 'old\n', 'utf-8');
    writeFile({ path: `${SCRATCH}/existing.txt`, content: 'new\n' });
    expect(readFileSync(`${SCRATCH}/existing.txt`, 'utf-8')).toBe('new\n');
  });

  it('rejects non-string content', () => {
    expect(() => writeFile({ path: `${SCRATCH}/x.txt`, content: 42 })).toThrow(
      PathGuardError
    );
  });

  it('routes through guardPath — refuses a blocked path like package.json', () => {
    expect(() => writeFile({ path: 'package.json', content: '{}' })).toThrow(
      PathGuardError
    );
  });
});

describe('writeFile — lazy omission placeholder guard', () => {
  it('refuses content containing an omission placeholder comment', () => {
    expect(() =>
      writeFile({
        path: `${SCRATCH}/lazy.ts`,
        content: 'const x = 1;\n// ... existing code ...\n',
      })
    ).toThrow(PathGuardError);
  });

  it('accepts content that happens to contain "..." outside the placeholder pattern', () => {
    expect(() =>
      writeFile({
        path: `${SCRATCH}/spread.ts`,
        content: 'const arr = [...a, ...b];\n',
      })
    ).not.toThrow();
  });
});

describe('writeFile — large file guard', () => {
  it('refuses to overwrite an existing file over the line-count limit', () => {
    const bigFile = Array.from(
      { length: 401 },
      (_, i) => `const x${i} = ${i};`
    ).join('\n');
    writeFileSync(`${SCRATCH}/huge.ts`, bigFile, 'utf-8');
    expect(() =>
      writeFile({ path: `${SCRATCH}/huge.ts`, content: 'const x = 1;' })
    ).toThrow(FileTooLargeError);
  });

  it('refuses to overwrite an existing file over the char-count limit even with few lines', () => {
    const bigFile = 'x'.repeat(16_000);
    writeFileSync(`${SCRATCH}/hugechars.ts`, bigFile, 'utf-8');
    expect(() =>
      writeFile({ path: `${SCRATCH}/hugechars.ts`, content: 'x' })
    ).toThrow(FileTooLargeError);
  });

  it('allows creating a brand-new file larger than the limit (only overwrites of existing files are capped)', () => {
    const bigContent = Array.from(
      { length: 500 },
      (_, i) => `const x${i} = ${i};`
    ).join('\n');
    expect(() =>
      writeFile({ path: `${SCRATCH}/brand-new-big.ts`, content: bigContent })
    ).not.toThrow();
  });
});

describe('writeFile — large deletion guard', () => {
  function makeMediumFile(path) {
    const content = Array.from(
      { length: 30 },
      (_, i) => `const x${i} = ${i};`
    ).join('\n');
    writeFileSync(path, content, 'utf-8');
  }

  it('refuses a >50% line reduction on a file over 20 lines without the intentional marker', () => {
    makeMediumFile(`${SCRATCH}/shrink.ts`);
    expect(() =>
      writeFile({ path: `${SCRATCH}/shrink.ts`, content: 'const x = 1;' })
    ).toThrow(PathGuardError);
  });

  it('allows the same large deletion when the intentional-deletion marker is present', () => {
    makeMediumFile(`${SCRATCH}/shrink-ok.ts`);
    expect(() =>
      writeFile({
        path: `${SCRATCH}/shrink-ok.ts`,
        content: '// ai-dev: intentional-deletion\nconst x = 1;',
      })
    ).not.toThrow();
  });

  it('does not trigger the guard on a small file (<=20 lines)', () => {
    const small = Array.from(
      { length: 10 },
      (_, i) => `const x${i} = ${i};`
    ).join('\n');
    writeFileSync(`${SCRATCH}/small.ts`, small, 'utf-8');
    expect(() =>
      writeFile({ path: `${SCRATCH}/small.ts`, content: 'const x = 1;' })
    ).not.toThrow();
  });

  it('does not trigger the guard when the new content is more than half the original', () => {
    makeMediumFile(`${SCRATCH}/trim.ts`);
    const trimmed = Array.from(
      { length: 20 },
      (_, i) => `const x${i} = ${i};`
    ).join('\n');
    expect(() =>
      writeFile({ path: `${SCRATCH}/trim.ts`, content: trimmed })
    ).not.toThrow();
  });
});

describe('writeFile — line-ending preservation', () => {
  it('preserves CRLF line endings on an existing CRLF file', () => {
    writeFileSync(`${SCRATCH}/crlf.txt`, 'line1\r\nline2\r\n', 'utf-8');
    writeFile({
      path: `${SCRATCH}/crlf.txt`,
      content: 'line1\nline2\nline3\n',
    });
    const result = readFileSync(`${SCRATCH}/crlf.txt`, 'utf-8');
    expect(result).toBe('line1\r\nline2\r\nline3\r\n');
  });

  it('uses LF for a brand-new file', () => {
    writeFile({ path: `${SCRATCH}/fresh.txt`, content: 'line1\nline2\n' });
    const result = readFileSync(`${SCRATCH}/fresh.txt`, 'utf-8');
    expect(result).toBe('line1\nline2\n');
    expect(result).not.toContain('\r');
  });
});

describe('deleteFile', () => {
  it('deletes an existing file', () => {
    writeFileSync(`${SCRATCH}/todelete.txt`, 'bye', 'utf-8');
    deleteFile({ path: `${SCRATCH}/todelete.txt` });
    expect(existsSync(`${SCRATCH}/todelete.txt`)).toBe(false);
  });

  it('throws for a non-existent file', () => {
    expect(() => deleteFile({ path: `${SCRATCH}/nope.txt` })).toThrow(
      PathGuardError
    );
  });

  it('refuses to delete a directory', () => {
    mkdirSync(`${SCRATCH}/adir`, { recursive: true });
    expect(() => deleteFile({ path: `${SCRATCH}/adir` })).toThrow(
      PathGuardError
    );
  });
});

describe('listDir', () => {
  it('lists files and directories with their type', () => {
    writeFileSync(`${SCRATCH}/one.txt`, 'x', 'utf-8');
    mkdirSync(`${SCRATCH}/sub`, { recursive: true });
    const { entries } = listDir({ path: SCRATCH });
    const names = entries.map((e) => e.name);
    expect(names).toContain('one.txt');
    expect(names).toContain('sub');
    expect(entries.find((e) => e.name === 'sub').type).toBe('dir');
    expect(entries.find((e) => e.name === 'one.txt').type).toBe('file');
  });

  it('throws for a non-existent directory', () => {
    expect(() => listDir({ path: `${SCRATCH}/nope` })).toThrow(PathGuardError);
  });

  it('throws when the path is a file, not a directory', () => {
    writeFileSync(`${SCRATCH}/afile.txt`, 'x', 'utf-8');
    expect(() => listDir({ path: `${SCRATCH}/afile.txt` })).toThrow(
      PathGuardError
    );
  });
});

describe('searchFiles', () => {
  it('finds a match in a newly-created (untracked) file', () => {
    writeFileSync(
      `${SCRATCH}/needle.ts`,
      'const veryUniqueSearchToken123 = 1;\n',
      'utf-8'
    );
    const result = searchFiles({
      pattern: 'veryUniqueSearchToken123',
      path: SCRATCH,
    });
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]).toContain('veryUniqueSearchToken123');
  });

  it('returns an empty match list (not an error) when nothing matches', () => {
    const result = searchFiles({
      pattern: 'definitelyNotAnywhereInThisRepoXYZ999',
      path: SCRATCH,
    });
    expect(result.matches).toEqual([]);
  });

  it('rejects an empty pattern', () => {
    expect(() => searchFiles({ pattern: '', path: SCRATCH })).toThrow(
      PathGuardError
    );
  });
});

describe('submitForReview', () => {
  it('acknowledges with the given summary', () => {
    expect(submitForReview({ summary: 'did the thing' })).toEqual({
      acknowledged: true,
      summary: 'did the thing',
    });
  });

  it('defaults to an empty summary when none is given', () => {
    expect(submitForReview({})).toEqual({ acknowledged: true, summary: '' });
  });
});
