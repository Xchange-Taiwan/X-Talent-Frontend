import { readFileSync } from 'node:fs';
import { upsertComment } from './lib/pr-comment.mjs';
import { AI_REVIEW_COMMENT_MARKER } from './lib/format-comment.mjs';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.PR_NUMBER;

if (!token) throw new Error('GITHUB_TOKEN env var is required');
if (!repo) throw new Error('GITHUB_REPOSITORY env var is required');
if (!issueNumber) throw new Error('PR_NUMBER env var is required');

const body = readFileSync('ai-review-comment.md', 'utf-8');

await upsertComment({
  repo,
  issueNumber,
  token,
  marker: AI_REVIEW_COMMENT_MARKER,
  body,
});
console.log('[post-comment] posted/updated PR comment');
