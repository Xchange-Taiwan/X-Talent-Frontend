#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Helper for bold and colored terminal output
const bold = (str) => `\x1b[1m${str}\x1b[22m`;
const green = (str) => `\x1b[32m${str}\x1b[39m`;
const yellow = (str) => `\x1b[33m${str}\x1b[39m`;
const red = (str) => `\x1b[31m${str}\x1b[39m`;
const cyan = (str) => `\x1b[36m${str}\x1b[39m`;

// Parse Arguments
const args = process.argv.slice(2);
let prTarget = args.find((arg) => !arg.startsWith('--'));
const intervalIndex = args.indexOf('--interval');
const timeoutIndex = args.indexOf('--timeout');

// Default polling interval: 5 minutes (300 seconds)
const pollingInterval =
  intervalIndex !== -1
    ? parseInt(args[intervalIndex + 1], 10) * 1000
    : 300 * 1000;
// Default timeout: 60 minutes (3600 seconds)
const maxTimeout =
  timeoutIndex !== -1
    ? parseInt(args[timeoutIndex + 1], 10) * 60 * 1000
    : 60 * 60 * 1000;

const startTime = Date.now();

// Load repository config from docs/agents/project-config.md to get org/repo if needed
let defaultRepo = '';
try {
  const configPath = path.resolve('docs/agents/project-config.md');
  if (fs.existsSync(configPath)) {
    const mdContent = fs.readFileSync(configPath, 'utf-8');
    const jsonMatch = mdContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const config = JSON.parse(jsonMatch[1]);
      defaultRepo = `${config.org}/${config.repos.frontend}`;
    }
  }
} catch (err) {
  // Silent fallback
}

// Ensure gh CLI is logged in and installed
try {
  execSync('gh --version', { stdio: 'ignore' });
} catch (err) {
  console.error(
    red("ERROR: GitHub CLI ('gh') is not installed or not in system PATH.")
  );
  process.exit(1);
}

// Find PR target if not specified
if (!prTarget) {
  console.log(
    cyan(
      'No PR target provided. Attempting to detect PR from the current branch...'
    )
  );
  try {
    const repoFlag = defaultRepo ? `--repo ${defaultRepo}` : '';
    const prJson = execSync(
      `gh pr view ${repoFlag} --json url,number,state,title`,
      { encoding: 'utf-8' }
    );
    const prData = JSON.parse(prJson);
    prTarget = prData.url;
    console.log(
      green(`Detected Active PR: #${prData.number} - "${prData.title}"`)
    );
    console.log(cyan(`PR URL: ${prData.url}\n`));
  } catch (err) {
    console.error(
      red(
        'ERROR: Could not find an active PR on the current branch. Please specify a PR URL or number.'
      )
    );
    process.exit(1);
  }
} else {
  // Validate PR link/number and fetch metadata
  try {
    const repoFlag = defaultRepo ? `--repo ${defaultRepo}` : '';
    const prJson = execSync(
      `gh pr view "${prTarget}" ${repoFlag} --json url,number,state,title`,
      { encoding: 'utf-8' }
    );
    const prData = JSON.parse(prJson);
    prTarget = prData.url;
    console.log(green(`Target PR: #${prData.number} - "${prData.title}"`));
    console.log(cyan(`PR URL: ${prData.url}\n`));
  } catch (err) {
    console.error(
      red(`ERROR: Could not fetch PR info for target: "${prTarget}".`)
    );
    process.exit(1);
  }
}

// Start polling checks
console.log(
  cyan(
    `Starting pipeline check monitor. Interval: ${pollingInterval / 1000}s, Timeout: ${maxTimeout / 60000}m.`
  )
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

while (true) {
  const elapsed = Date.now() - startTime;
  if (elapsed > maxTimeout) {
    console.error(
      red(
        `\n❌ ERROR: Monitoring timed out after ${maxTimeout / 60000} minutes.`
      )
    );
    process.exit(1);
  }

  try {
    const repoFlag = defaultRepo ? `--repo ${defaultRepo}` : '';
    const checksJson = execSync(
      `gh pr checks "${prTarget}" ${repoFlag} --json bucket,name,state,link,workflow`,
      { encoding: 'utf-8' }
    );
    const checks = JSON.parse(checksJson);

    if (checks.length === 0) {
      console.log(
        yellow(
          '⚠️  No checks detected on this PR yet. They may be queuing or registration is pending.'
        )
      );
    } else {
      const passing = [];
      const pending = [];
      const failing = [];

      for (const check of checks) {
        // gh CLI returns "pass", "fail", "pending", "skipping", "cancel" in bucket field
        if (
          check.bucket === 'pass' ||
          check.state === 'success' ||
          check.bucket === 'skipping'
        ) {
          passing.push(check);
        } else if (
          check.bucket === 'pending' ||
          check.state === 'pending' ||
          check.state === 'in_progress' ||
          check.state === 'queued'
        ) {
          pending.push(check);
        } else {
          failing.push(check);
        }
      }

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] Checks Status: ${green(`${passing.length} passing`)}, ${yellow(`${pending.length} pending`)}, ${red(`${failing.length} failing`)}`
      );

      // If there are failing checks, report them and exit immediately
      if (failing.length > 0) {
        console.error(red(`\n❌ Failed checks detected on PR!`));
        for (const check of failing) {
          console.error(red(`  - ${bold(check.name)} (${check.state})`));
          if (check.link) console.error(`    Log Link: ${check.link}`);
        }
        process.exit(2); // Exit with code 2 indicating CI check failed
      }

      // If everything passes and there are no pending checks, exit with success
      if (pending.length === 0 && failing.length === 0 && passing.length > 0) {
        console.log(
          green(
            `\n🎉 All checks have successfully passed! Pipeline is completely clean.`
          )
        );
        process.exit(0);
      }
    }
  } catch (err) {
    console.warn(
      yellow(`⚠️  Failed to query PR checks (will retry): ${err.message}`)
    );
  }

  // Sleep before next poll
  console.log(
    cyan(
      `Waiting ${pollingInterval / 1000 / 60} minutes before next check...\n`
    )
  );
  await sleep(pollingInterval);
}
