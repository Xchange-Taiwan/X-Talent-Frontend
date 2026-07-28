import { readFileSync } from 'node:fs';

const SHARED_DIR = new URL('../prompts/_shared/', import.meta.url);

function loadShared() {
  return {
    projectContext: readFileSync(
      new URL('project-context.md', SHARED_DIR),
      'utf-8'
    ),
    reviewDiscipline: readFileSync(
      new URL('review-discipline.md', SHARED_DIR),
      'utf-8'
    ),
    businessRules: readFileSync(
      new URL('business-rules.md', SHARED_DIR),
      'utf-8'
    ),
    codeSmellBaseline: readFileSync(
      new URL('code-smell-baseline.md', SHARED_DIR),
      'utf-8'
    ),
  };
}

/**
 * Loads an agent's prompt template (a URL, e.g. `new URL('../prompts/security.md', import.meta.url)`)
 * and fills in the shared fragments plus any agent-specific replacements.
 * Placeholders are `{{NAME}}` tokens; unknown placeholders are left as-is.
 */
export function buildPrompt(templateUrl, replacements = {}) {
  const { projectContext, reviewDiscipline, businessRules, codeSmellBaseline } =
    loadShared();
  let template = readFileSync(templateUrl, 'utf-8');

  const all = {
    PROJECT_CONTEXT: projectContext,
    REVIEW_DISCIPLINE: reviewDiscipline,
    BUSINESS_RULES: businessRules,
    CODE_SMELL_BASELINE: codeSmellBaseline,
    ...replacements,
  };
  for (const [key, value] of Object.entries(all)) {
    template = template.split(`{{${key}}}`).join(value);
  }
  return template;
}
