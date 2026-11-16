#!/usr/bin/env node
/**
 * Thin cross-platform AfterAgent / Stop hook delegator into `../tracker-ops.mjs`.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyAndHealBoardStatus } from '../tracker-ops.mjs';

export { verifyAndHealBoardStatus } from '../tracker-ops.mjs';

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const argv = process.argv.slice(2);
  const outcome = verifyAndHealBoardStatus({ dialect: 'gemini', argv });
  process.exit(outcome.exitCode);
}
