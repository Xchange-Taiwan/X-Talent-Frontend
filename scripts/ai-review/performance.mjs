import { runAgent } from './lib/run-agent.mjs';

await runAgent({
  promptUrl: new URL('./prompts/performance.md', import.meta.url),
  upstreamEnvVars: {
    PLAN_JSON: 'PLAN_B64',
    SECURITY_FINDINGS_JSON: 'SECURITY_FINDINGS_B64',
    CORRECTNESS_FINDINGS_JSON: 'CORRECTNESS_FINDINGS_B64',
  },
  outputName: 'findings',
});
