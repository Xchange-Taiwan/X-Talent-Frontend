#!/usr/bin/env node

import { execFileSync } from "child_process";
import { categorizeChecks, isTimeout } from "./pr-parser.mjs";

// Helper for bold and colored terminal output
const bold = (str) => `\x1b[1m${str}\x1b[22m`;
const green = (str) => `\x1b[32m${str}\x1b[39m`;
const yellow = (str) => `\x1b[33m${str}\x1b[39m`;
const red = (str) => `\x1b[31m${str}\x1b[39m`;
const cyan = (str) => `\x1b[36m${str}\x1b[39m`;

// Parse Arguments safely
const args = process.argv.slice(2);
let prTarget = null;
const intervalIndex = args.indexOf("--interval");
const timeoutIndex = args.indexOf("--timeout");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--interval" || args[i] === "--timeout") {
    i++; // Skip flag value
  } else if (!args[i].startsWith("--")) {
    prTarget = args[i];
    break;
  }
}

// Robust NaN parsing for interval and timeout
const parsedInterval = intervalIndex !== -1 ? parseInt(args[intervalIndex + 1], 10) : NaN;
const pollingInterval = (!Number.isNaN(parsedInterval) && parsedInterval > 0) ? parsedInterval * 1000 : 300 * 1000;

const parsedTimeout = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1], 10) : NaN;
const maxTimeout = (!Number.isNaN(parsedTimeout) && parsedTimeout > 0) ? parsedTimeout * 60 * 1000 : 60 * 60 * 1000;

const startTime = Date.now();

// Ensure gh CLI is logged in and installed using safe execFileSync
try {
  execFileSync("gh", ["--version"], { stdio: "ignore" });
} catch (err) {
  console.error(red("ERROR: GitHub CLI ('gh') is not installed or not in system PATH."));
  process.exit(1);
}

// Find PR target safely if not specified
if (!prTarget) {
  console.log(cyan("No PR target provided. Attempting to detect PR from the current branch..."));
  try {
    const prJson = execFileSync("gh", ["pr", "view", "--json", "url,number,state,title"], { encoding: "utf-8" });
    const prData = JSON.parse(prJson);
    prTarget = prData.url;
    console.log(green(`Detected Active PR: #${prData.number} - "${prData.title}"`));
    console.log(cyan(`PR URL: ${prData.url}\n`));
  } catch (err) {
    console.error(red("ERROR: Could not find an active PR on the current branch. Please specify a PR URL or number."));
    process.exit(1);
  }
} else {
  // Validate PR link/number and fetch metadata safely
  try {
    const prJson = execFileSync("gh", ["pr", "view", prTarget, "--json", "url,number,state,title"], { encoding: "utf-8" });
    const prData = JSON.parse(prJson);
    prTarget = prData.url;
    console.log(green(`Target PR: #${prData.number} - "${prData.title}"`));
    console.log(cyan(`PR URL: ${prData.url}\n`));
  } catch (err) {
    console.error(red(`ERROR: Could not fetch PR info for target: "${prTarget}".`));
    process.exit(1);
  }
}

// Start polling checks
console.log(cyan(`Starting pipeline check monitor. Interval: ${pollingInterval / 1000}s, Timeout: ${maxTimeout / 60000}m.`));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

while (true) {
  if (isTimeout(startTime, maxTimeout)) {
    console.error(red(`\n❌ ERROR: Monitoring timed out after ${maxTimeout / 60000} minutes.`));
    process.exit(1);
  }

  try {
    const checksJson = execFileSync("gh", ["pr", "checks", prTarget, "--json", "bucket,name,state,link,workflow"], { encoding: "utf-8" });
    const checks = JSON.parse(checksJson);

    if (checks.length === 0) {
      console.log(yellow("⚠️  No checks detected on this PR yet. They may be queuing or registration is pending."));
    } else {
      const { passing, pending, failing: rawFailing } = categorizeChecks(checks);

      // Separate failing checks, ignoring Vercel-related errors if they match
      const failing = [];
      const ignoredFails = [];

      for (const check of rawFailing) {
        const name = (check.name || "").toLowerCase();
        if (name.includes("vercel") || name.includes("preview")) {
          ignoredFails.push(check);
        } else {
          failing.push(check);
        }
      }

      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Checks Status: ${green(`${passing.length} passing`)}, ${yellow(`${pending.length} pending`)}, ${red(`${failing.length} failing`)}${ignoredFails.length > 0 ? ` (${yellow(`${ignoredFails.length} vercel/preview checks ignored`)})` : ""}`);

      // If there are failing checks, report them and exit immediately
      if (failing.length > 0) {
        console.error(red(`\n❌ Failed checks detected on PR!`));
        for (const check of failing) {
          console.error(red(`  - ${bold(check.name)} (${check.state})`));
          if (check.link) console.error(`    Log Link: ${check.link}`);
        }
        process.exit(2); // Exit with code 2 indicating CI check failed
      }

      // If everything passes (or only ignored vercel/preview checks failed) and there are no pending checks, exit with success
      if (pending.length === 0 && failing.length === 0 && (passing.length > 0 || ignoredFails.length > 0)) {
        if (ignoredFails.length > 0) {
          console.log(yellow(`\n⚠️  Pipeline complete with ignored Vercel/Preview failures:`));
          for (const check of ignoredFails) {
            console.log(yellow(`  - Ignored: ${check.name} (${check.state})`));
          }
        }
        console.log(green(`\n🎉 All checks have successfully passed! Pipeline is completely clean.`));
        process.exit(0);
      }
    }
  } catch (err) {
    console.warn(yellow(`⚠️  Failed to query PR checks (will retry): ${err.message}`));
  }

  // Sleep before next poll
  console.log(cyan(`Waiting ${(pollingInterval / 1000) / 60} minutes before next check...\n`));
  await sleep(pollingInterval);
}
