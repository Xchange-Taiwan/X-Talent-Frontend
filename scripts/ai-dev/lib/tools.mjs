import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

import { guardPath, PathGuardError } from './path-guard.mjs';
import { runProcess } from './proc.mjs';

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.bmp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.mp4',
  '.mp3',
  '.mov',
]);

const MAX_READ_CHARS = 20_000;
const MAX_LIST_ENTRIES = 200;
const MAX_SEARCH_MATCHES = 100;
const MAX_SEARCH_CHARS = 8_000;

// A full-file rewrite that gets truncated mid-JSON by MAX_TOKENS is worse
// than refusing up front — the agent ends up in an unrecoverable parse-error
// loop. v1 has no patch-based edit tool, so large files are simply out of
// scope (tracked as a v2 follow-up).
const LARGE_FILE_LINE_LIMIT = 400;
const LARGE_FILE_CHAR_LIMIT = 15_000;

export class FileTooLargeError extends Error {}
export class BinaryFileError extends Error {}

function extensionOf(relativePath) {
  const match = relativePath.match(/\.[^./]+$/);
  return match ? match[0].toLowerCase() : '';
}

function looksBinary(buffer) {
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

function detectLineEnding(content) {
  return content.includes('\r\n') ? 'crlf' : 'lf';
}

function toLineEnding(content, style) {
  const normalized = content.replace(/\r\n/g, '\n');
  return style === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

const LAZY_PLACEHOLDER_PATTERN =
  /\/\/\s*\.\.\.\s*(existing|rest of|remainder|unchanged)|\/\*\s*\.\.\.\s*\*\//i;

export function readFile({ path }) {
  const { absolutePath, relativePath } = guardPath(path);

  if (BINARY_EXTENSIONS.has(extensionOf(relativePath))) {
    throw new BinaryFileError(
      `"${relativePath}" is a binary file and cannot be read as text.`
    );
  }
  if (!existsSync(absolutePath)) {
    throw new PathGuardError(`"${relativePath}" does not exist.`);
  }

  const buffer = readFileSync(absolutePath);
  if (looksBinary(buffer)) {
    throw new BinaryFileError(
      `"${relativePath}" appears to be binary (contains null bytes) and cannot be read as text.`
    );
  }

  const content = buffer.toString('utf-8');
  if (content.length <= MAX_READ_CHARS) {
    return { path: relativePath, content, truncated: false };
  }
  return {
    path: relativePath,
    content: `${content.slice(0, MAX_READ_CHARS)}\n\n... (truncated, ${content.length} chars total — read a narrower range or use searchFiles)`,
    truncated: true,
  };
}

export function writeFile({ path, content }) {
  const { absolutePath, relativePath } = guardPath(path);

  if (typeof content !== 'string') {
    throw new PathGuardError('content must be a string.');
  }
  if (LAZY_PLACEHOLDER_PATTERN.test(content)) {
    throw new PathGuardError(
      'Refused: content contains an omission placeholder (e.g. "// ... existing code ..."). ' +
        'writeFile overwrites the whole file — you must supply the complete file content.'
    );
  }

  const fileExists = existsSync(absolutePath);
  let lineEndingStyle = 'lf';
  let originalContent = '';

  if (fileExists) {
    originalContent = readFileSync(absolutePath, 'utf-8');
    lineEndingStyle = detectLineEnding(originalContent);

    if (
      originalContent.length > LARGE_FILE_CHAR_LIMIT ||
      originalContent.split('\n').length > LARGE_FILE_LINE_LIMIT
    ) {
      throw new FileTooLargeError(
        `"${relativePath}" exceeds v1's full-file-rewrite limit (${LARGE_FILE_LINE_LIMIT} lines / ${LARGE_FILE_CHAR_LIMIT} chars). ` +
          'Narrow the change to a smaller file, or split the task.'
      );
    }

    const originalLines = originalContent.split('\n').length;
    const newLines = content.split('\n').length;
    if (originalLines > 20 && newLines < originalLines * 0.5) {
      throw new PathGuardError(
        `Refused: new content for "${relativePath}" has ${newLines} lines vs the original's ${originalLines} — ` +
          'this looks like truncated/lazy output, not an intentional large deletion. ' +
          'Re-read the file and supply the full content, or confirm this deletion is intentional by writing again with a comment noting so.'
      );
    }
  }

  mkdirSync(dirname(absolutePath), { recursive: true });
  const finalContent = toLineEnding(content, lineEndingStyle);
  writeFileSync(absolutePath, finalContent, 'utf-8');

  return {
    path: relativePath,
    bytesWritten: Buffer.byteLength(finalContent, 'utf-8'),
  };
}

export function deleteFile({ path }) {
  const { absolutePath, relativePath } = guardPath(path);

  if (!existsSync(absolutePath)) {
    throw new PathGuardError(`"${relativePath}" does not exist.`);
  }
  if (!statSync(absolutePath).isFile()) {
    throw new PathGuardError(
      `"${relativePath}" is not a file — deleteFile cannot remove directories.`
    );
  }

  unlinkSync(absolutePath);
  return { path: relativePath, deleted: true };
}

export function listDir({ path = '.' }) {
  const { absolutePath, relativePath } = guardPath(path);

  if (!existsSync(absolutePath) || !statSync(absolutePath).isDirectory()) {
    throw new PathGuardError(`"${relativePath || '.'}" is not a directory.`);
  }

  const entries = readdirSync(absolutePath, { withFileTypes: true })
    .filter((e) => e.name !== 'node_modules' && e.name !== '.git')
    .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length <= MAX_LIST_ENTRIES) {
    return { path: relativePath || '.', entries, truncated: false };
  }
  return {
    path: relativePath || '.',
    entries: entries.slice(0, MAX_LIST_ENTRIES),
    truncated: true,
    note: `${entries.length - MAX_LIST_ENTRIES} more entries not shown — narrow the path.`,
  };
}

export function searchFiles({ pattern, path = '.' }) {
  const { relativePath } = guardPath(path);
  if (!pattern || typeof pattern !== 'string') {
    throw new PathGuardError('pattern must be a non-empty string.');
  }

  let raw;
  try {
    raw = execFileSync(
      'git',
      // --untracked: the agent's own new files aren't committed yet, and a
      // search that silently skips them would be worse than useless.
      // -e forces the next arg to be treated as the pattern, not an option —
      // without it a pattern starting with `-` (LLM-generated or injected
      // via ticket content) would be parsed as a git grep flag.
      [
        'grep',
        '-n',
        '-I',
        '--untracked',
        '-E',
        '-e',
        pattern,
        '--',
        relativePath || '.',
      ],
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    );
  } catch (err) {
    if (err.status === 1) {
      return { pattern, matches: [], truncated: false };
    }
    throw new PathGuardError(`search failed: ${err.message}`);
  }

  const lines = raw.split('\n').filter(Boolean);
  const limited = lines.slice(0, MAX_SEARCH_MATCHES);
  let charBudget = MAX_SEARCH_CHARS;
  const matches = [];
  for (const line of limited) {
    charBudget -= line.length;
    if (charBudget < 0) break;
    matches.push(line);
  }

  return {
    pattern,
    matches,
    truncated: lines.length > matches.length,
    note:
      lines.length > matches.length
        ? `${lines.length - matches.length} more matches not shown — narrow the pattern or path.`
        : undefined,
  };
}

export const SUBMIT_FOR_REVIEW_TOOL = 'submitForReview';

export function submitForReview({ summary }) {
  return { acknowledged: true, summary: summary ?? '' };
}

// The agent may self-check with these before submitting; the orchestrator
// also force-runs lint/type-check independently regardless (see checks.mjs) —
// this is a self-serve convenience, not the enforcement mechanism.
const ALLOWED_COMMANDS = {
  'pnpm lint': ['pnpm', ['lint']],
  'pnpm lint:fix': ['pnpm', ['lint:fix']],
  'pnpm type-check': ['pnpm', ['type-check']],
  'pnpm test': ['pnpm', ['test']],
  'pnpm build': ['pnpm', ['build']],
};

export async function runCommand({ command }) {
  const entry = ALLOWED_COMMANDS[command];
  if (!entry) {
    throw new PathGuardError(
      `"${command}" is not in the whitelist. Allowed: ${Object.keys(ALLOWED_COMMANDS).join(', ')}`
    );
  }
  const [bin, args] = entry;
  const { code, stdout, stderr, timedOut } = await runProcess(bin, args, {
    timeoutMs:
      command === 'pnpm test' || command === 'pnpm build' ? 120_000 : 60_000,
  });
  return { command, exitCode: code, stdout, stderr, timedOut };
}

/** Gemini function-declaration schemas for every tool exposed to the dev agent. */
export const TOOL_DECLARATIONS = [
  {
    name: 'readFile',
    description:
      'Read a text file in the repository. Returns the full content (truncated if very large).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repo-relative path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'writeFile',
    description:
      'Overwrite (or create) a text file with the complete new content. Never use omission placeholders — always supply the full file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repo-relative path.' },
        content: { type: 'string', description: 'Complete file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'deleteFile',
    description: 'Delete a single file (not a directory).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repo-relative path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'listDir',
    description: 'List entries in a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repo-relative directory path, default "."',
        },
      },
    },
  },
  {
    name: 'searchFiles',
    description: 'Search tracked files for a regex pattern (like git grep -E).',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Extended regex pattern.' },
        path: {
          type: 'string',
          description: 'Repo-relative scope, default "."',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'runCommand',
    description: `Run a whitelisted project command. Allowed: ${Object.keys(ALLOWED_COMMANDS).join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: Object.keys(ALLOWED_COMMANDS) },
      },
      required: ['command'],
    },
  },
  {
    name: SUBMIT_FOR_REVIEW_TOOL,
    description:
      'Call this when your changes for this iteration are complete and ready for the reviewer. This is the only way to hand control back to the orchestrator — do not just describe completion in text.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One-paragraph summary of what changed.',
        },
      },
      required: ['summary'],
    },
  },
];

const HANDLERS = {
  readFile,
  writeFile,
  deleteFile,
  listDir,
  searchFiles,
  runCommand,
  [SUBMIT_FOR_REVIEW_TOOL]: submitForReview,
};

/** Executes a tool by name. Throws on unknown tool or on any guard/handler error — callers must catch and turn this into a function-error response, never let it crash the process (see gemini-agent.mjs). */
export async function executeTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) {
    throw new PathGuardError(`Unknown tool "${name}".`);
  }
  return handler(args ?? {});
}
