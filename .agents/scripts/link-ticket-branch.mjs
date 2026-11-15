#!/usr/bin/env node
/**
 * Thin Node CLI compatibility entrypoint & re-exporter around `./tracker-ops.mjs`.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { linkTicketBranch, redactCredentials } from './tracker-ops.mjs';

const LF = String.fromCharCode(10);

export {
  deriveBranchNameFromIssue,
  linkTicketBranch,
  queryBranchOpenPrState,
  resolveTicketBranchPlan,
  shouldPreserveBoardStatus,
} from './tracker-ops.mjs';

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  try {
    linkTicketBranch(process.argv.slice(2));
  } catch (err) {
    const msg = redactCredentials(err?.message || String(err));
    process.stderr.write(`${msg}${LF}`);
    process.exit(err?.exitCode || 1);
  }
}
