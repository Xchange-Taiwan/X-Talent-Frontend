// Drives one QA scenario via an MCP browser session, using the same
// tool-calling primitives as scripts/ai-dev/lib/gemini-agent.mjs (already a
// generic systemInstruction/contents/tools loop — reused as-is, not
// reimplemented).
import {
  callGeminiAgent,
  extractFunctionCalls,
  functionResponseTurn,
  modelTurnFromCandidate,
  userTurn,
} from '../../ai-dev/lib/gemini-agent.mjs';
import { buildPrompt } from '../../ai-review/lib/prompt.mjs';
import { extractSnapshotText, McpToolError } from './mcp-client.mjs';

const SYSTEM_PROMPT_URL = new URL(
  '../prompts/qa-agent-system.md',
  import.meta.url
);
const MAX_TURNS = 20;
const REPORT_TOOL = 'reportScenarioResult';

// Gemini function declarations for the fixed MCP tool subset the QA agent is
// allowed to call. Hand-written (not derived from the MCP tool list at
// runtime) so the executor's contract can't silently change if a future
// @playwright/mcp version renames/adds fields — schemas confirmed against
// @playwright/mcp@0.0.78's actual inputSchema via a throwaway smoke test.
const TOOL_DECLARATIONS = [
  {
    name: 'browser_navigate',
    description: 'Navigate the page to a URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_snapshot',
    description:
      'Get the current page as an accessibility tree. Interactive elements have a `ref` — use it as `target` for browser_click/browser_type.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'browser_click',
    description: 'Click an element by its snapshot ref.',
    parameters: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable description of the element.',
        },
        target: {
          type: 'string',
          description: 'The ref from the latest browser_snapshot.',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into an element by its snapshot ref.',
    parameters: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable description of the element.',
        },
        target: {
          type: 'string',
          description: 'The ref from the latest browser_snapshot.',
        },
        text: { type: 'string', description: 'Text to type.' },
        submit: { type: 'boolean', description: 'Press Enter after typing.' },
      },
      required: ['target', 'text'],
    },
  },
  {
    name: 'browser_wait_for',
    description:
      'Wait for text to appear/disappear, or a fixed number of seconds.',
    parameters: {
      type: 'object',
      properties: {
        time: { type: 'number', description: 'Seconds to wait.' },
        text: { type: 'string', description: 'Text to wait for.' },
        textGone: { type: 'string', description: 'Text to wait to disappear.' },
      },
    },
  },
  {
    name: REPORT_TOOL,
    description:
      'Call this exactly once, when you are done checking the scenario against its expected result. This is the only way to end the scenario.',
    parameters: {
      type: 'object',
      properties: {
        passed: {
          type: 'boolean',
          description: 'Whether the expected result held.',
        },
        reason: {
          type: 'string',
          description:
            'One or two sentences explaining the verdict, in Traditional Chinese.',
        },
        classification: {
          type: 'string',
          enum: ['environment-error'],
          description:
            'Set only when passed=false AND the failure was a systemic/environment issue (500, blank page, network failure) — not a genuine assertion mismatch.',
        },
      },
      required: ['passed', 'reason'],
    },
  },
];

function buildSystemPrompt(scenario) {
  return buildPrompt(SYSTEM_PROMPT_URL, {
    ROLE: scenario.role,
    ROUTE: scenario.route,
    DESCRIPTION: scenario.description,
    EXPECTED: scenario.expected,
  });
}

/**
 * Runs one scenario to completion (or until the turn budget is exhausted).
 * Returns `{ status: 'passed'|'failed'|'infra-error', reason }`.
 *
 * `infra-error` covers two distinct causes, both deliberately NOT fed back
 * to the dev agent as "fix your code" (see issue #318's test-bug-vs-code-bug
 * discussion): the agent reporting classification:'environment-error', or
 * the turn budget running out without a report at all (the agent got stuck
 * operating — not a confirmed functional assertion).
 */
export async function runScenario({ session, scenario, baseUrl }) {
  const systemPrompt = buildSystemPrompt(scenario);
  const contents = [
    userTurn(`請開始執行這個情境，起始頁面網址為 ${baseUrl}${scenario.route}`),
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const candidate = await callGeminiAgent({
      systemInstruction: systemPrompt,
      contents,
      tools: TOOL_DECLARATIONS,
    });
    contents.push(modelTurnFromCandidate(candidate));

    const calls = extractFunctionCalls(candidate);
    if (calls.length === 0) {
      contents.push(
        userTurn(
          'You must call a tool to make progress. Call reportScenarioResult when you are done.'
        )
      );
      continue;
    }

    const results = [];
    let report = null;
    for (const call of calls) {
      if (call.name === REPORT_TOOL) {
        report = call.args;
        results.push({ name: call.name, response: { acknowledged: true } });
        continue;
      }
      try {
        const mcpResult = await session.callTool(call.name, call.args);
        results.push({
          name: call.name,
          response: { text: extractSnapshotText(mcpResult) },
        });
      } catch (err) {
        const message = err instanceof McpToolError ? err.message : `${err}`;
        results.push({ name: call.name, response: { error: message } });
      }
    }

    contents.push(functionResponseTurn(results));

    if (report) {
      if (report.classification === 'environment-error') {
        return { status: 'infra-error', reason: report.reason ?? '' };
      }
      return {
        status: report.passed ? 'passed' : 'failed',
        reason: report.reason ?? '',
      };
    }
  }

  return {
    status: 'infra-error',
    reason: `Turn budget (${MAX_TURNS}) exhausted without calling ${REPORT_TOOL} — the agent got stuck operating, not a confirmed assertion failure.`,
  };
}
