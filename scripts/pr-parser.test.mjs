import { describe, it, expect } from 'vitest';
import {
  categorizeChecks,
  isTimeout,
  parseAIReviewComments,
  filterIgnoredChecks,
} from '../.agents/scripts/pr-parser.mjs';

describe('categorizeChecks', () => {
  it('should categorize successful and skipped checks as passing (case-insensitive)', () => {
    const mockChecks = [
      { name: 'build', bucket: 'PASS' },
      { name: 'lint', state: 'SUCCESS' },
      { name: 'deploy', bucket: 'skipping' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(3);
    expect(pending).toHaveLength(0);
    expect(failing).toHaveLength(0);
  });

  it('should categorize pending and queued checks as pending (case-insensitive)', () => {
    const mockChecks = [
      { name: 'build', bucket: 'PENDING' },
      { name: 'test', state: 'IN_PROGRESS' },
      { name: 'lint', state: 'queued' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(0);
    expect(pending).toHaveLength(3);
    expect(failing).toHaveLength(0);
  });

  it('should categorize failing and cancelled checks as failing (case-insensitive)', () => {
    const mockChecks = [
      { name: 'build', bucket: 'FAIL' },
      { name: 'test', state: 'FAILED' },
      { name: 'lint', bucket: 'cancel' },
    ];
    const { passing, pending, failing } = categorizeChecks(mockChecks);
    expect(passing).toHaveLength(0);
    expect(pending).toHaveLength(0);
    expect(failing).toHaveLength(3);
  });
});

describe('isTimeout', () => {
  it('should return false if elapsed time is within timeout', () => {
    const startTime = 1000;
    const maxTimeout = 5000;
    const currentTime = 3000;
    expect(isTimeout(startTime, maxTimeout, currentTime)).toBe(false);
  });

  it('should return true if elapsed time exceeds timeout', () => {
    const startTime = 1000;
    const maxTimeout = 5000;
    const currentTime = 7000;
    expect(isTimeout(startTime, maxTimeout, currentTime)).toBe(true);
  });
});

describe('filterIgnoredChecks', () => {
  it('should separate critical failures from ignored Vercel/Preview failures', () => {
    const mockFailures = [
      { name: 'Unit & Integration Tests', state: 'failed' },
      { name: 'Deploy to Vercel (Pull Request Preview)', state: 'failed' },
      { name: 'Preview Deploy Build', state: 'failed' },
      { name: 'Code Quality Check', state: 'failed' },
    ];

    const { critical, ignored } = filterIgnoredChecks(mockFailures);
    expect(critical).toHaveLength(2);
    expect(critical[0].name).toBe('Unit & Integration Tests');
    expect(critical[1].name).toBe('Code Quality Check');

    expect(ignored).toHaveLength(2);
    expect(ignored[0].name).toBe('Deploy to Vercel (Pull Request Preview)');
    expect(ignored[1].name).toBe('Preview Deploy Build');
  });
});

describe('parseAIReviewComments', () => {
  it('should return empty if there are no comments', () => {
    expect(parseAIReviewComments([], [])).toHaveLength(0);
  });

  it('should identify and parse bot comments containing AI review markers', () => {
    const mockComments = [
      {
        author: { login: 'github-actions' },
        body: '<!-- ai-review-pipeline -->\n## 🤖 AI Review Pipeline\n\n### ⚠️ Overall   Risk\n**high**\n\n- **[Command Injection]** `.agents/scripts/monitor-pr.mjs:81`\n> Why it matters: Command injection risk is high.',
        url: 'https://github.com/...',
      },
    ];

    const findings = parseAIReviewComments(mockComments, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].author).toBe('github-actions');
    expect(findings[0].risk).toBe('high');
    expect(findings[0].issues).toHaveLength(1);
    expect(findings[0].issues[0].issue).toContain('Command Injection');
    expect(findings[0].issues[0].description).toBe(
      '> Why it matters: Command injection risk is high.'
    );
  });

  it('should parse reviews array with AI comments correctly', () => {
    const mockReviews = [
      {
        author: { login: 'ai-review-bot' },
        body: '🤖 AI Review Pipeline\n\nOverall Risk\n**medium**',
        url: 'https://github.com/...',
      },
    ];

    const findings = parseAIReviewComments([], mockReviews);
    expect(findings).toHaveLength(1);
    expect(findings[0].author).toBe('ai-review-bot');
    expect(findings[0].risk).toBe('medium');
  });

  it('should filter out and completely ignore regular non-AI user comments', () => {
    const mockComments = [
      {
        author: { login: 'human-dev' },
        body: 'Great job on this PR! Code looks clean.',
        url: 'https://github.com/...',
      },
    ];

    const findings = parseAIReviewComments(mockComments, []);
    expect(findings).toHaveLength(0);
  });

  it("should fallback risk to 'unknown' when Overall Risk block is missing", () => {
    const mockComments = [
      {
        author: { login: 'github-actions' },
        body: '🤖 AI Review Pipeline\n\n- **[Minor Issue]** `.agents/scripts/pr-parser.mjs:5` \n> Info: Minor issue.',
        url: 'https://github.com/...',
      },
    ];

    const findings = parseAIReviewComments(mockComments, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].risk).toBe('unknown');
    expect(findings[0].issues).toHaveLength(1);
  });

  // 🧪 New boundary test case 4: Parse issues with no description safely (no blockquote)
  it("should parse issues with no description safely (no blockquote)", () => {
    const mockComments = [
      {
        author: { login: "github-actions" },
        body: '🤖 AI Review Pipeline\n\n- **[No Description Issue]** `.agents/scripts/pr-parser.mjs:5` \nThis line is regular text and is NOT a blockquote.',
        url: "https://github.com/..."
      }
    ];

    const findings = parseAIReviewComments(mockComments, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].issues).toHaveLength(1);
    expect(findings[0].issues[0].issue).toContain("No Description Issue");
    expect(findings[0].issues[0].description).toBe(""); // empty because no blockquote (">")
  });

  // 🧪 New boundary test case 5: Parse issues located on the absolute last line safely
  it("should parse issues located on the absolute last line safely", () => {
    const mockComments = [
      {
        author: { login: "github-actions" },
        body: '🤖 AI Review Pipeline\n\n- **[Last Line Issue]** `.agents/scripts/pr-parser.mjs:5`',
        url: "https://github.com/..."
      }
    ];

    const findings = parseAIReviewComments(mockComments, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].issues).toHaveLength(1);
    expect(findings[0].issues[0].issue).toContain("Last Line Issue");
    expect(findings[0].issues[0].description).toBe(""); // empty because last line has no next line
  });
});
