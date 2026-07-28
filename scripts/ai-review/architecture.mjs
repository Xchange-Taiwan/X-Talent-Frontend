import { runAgent } from './lib/run-agent.mjs';

await runAgent({
  promptUrl: new URL('./prompts/architecture.md', import.meta.url),
  upstreamEnvVars: {
    PLAN_JSON: 'PLAN_B64',
  },
  outputName: 'findings',
});
