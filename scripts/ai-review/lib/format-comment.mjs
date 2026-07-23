export const AI_REVIEW_COMMENT_MARKER = '<!-- ai-review-pipeline -->';

function renderFindingsSection(title, result) {
  if (!result) {
    return `### ${title}\n_（未執行）_`;
  }
  if (!result.hasFindings || !result.findings?.length) {
    return `### ${title}\n✅ ${result.summary || '未發現需要人工關注的問題'}`;
  }

  const rows = result.findings
    .map((f) => {
      const loc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      return [
        `- **[${f.category}]** ${loc}`,
        `  ${f.issue}`,
        `  > 為什麼重要：${f.why}`,
        `  > 建議修法：${f.fix}`,
      ].join('\n');
    })
    .join('\n');

  return `### ${title}\n${result.summary}\n\n${rows}`;
}

function renderRequirementCoverage(plan, summary) {
  if (summary?.requirementCoverage?.length) {
    return summary.requirementCoverage
      .map(
        (c) =>
          `- ${c.covered ? '✅' : '⚠️'} ${c.criterion}${c.note ? ` — ${c.note}` : ''}`
      )
      .join('\n');
  }
  return plan?.ticketFound
    ? '_（無法判斷）_'
    : '_（此 PR 找不到對應 ticket，無 acceptance criteria 可比對）_';
}

function renderMissingTests(testing) {
  if (!testing?.hasFindings || !testing.findings?.length) {
    return '（無）';
  }
  return testing.findings
    .map((f) => `- \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.issue}`)
    .join('\n');
}

function renderReviewGuide(reviewGuide) {
  if (!reviewGuide) {
    return null;
  }

  const order =
    Array.isArray(reviewGuide.readingOrder) && reviewGuide.readingOrder.length
      ? reviewGuide.readingOrder
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((f) => `${f.order}. \`${f.file}\` — ${f.why}`)
          .join('\n')
      : null;

  return [
    '### 🧭 Review Guide',
    reviewGuide.overview ?? '',
    order ? '\n**建議閱讀順序：**\n' + order : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Assembles the single PR comment the pipeline posts: a review guide
 * (overview + suggested reading order) up top, Planner's requirement
 * summary, each agent's findings, then the final Requirement Coverage /
 * Overall Risk / Missing Tests / Merge Recommendation block.
 *
 * Every field is read defensively (optional chaining, `!result` fallbacks):
 * a stage that never ran, whose output failed to decode, or whose final
 * judgment call failed should still result in a postable comment covering
 * whatever *did* succeed, rather than the whole thing blowing up.
 */
export function formatComment({
  plan,
  reviewGuide,
  security,
  correctness,
  performance,
  testing,
  architecture,
  summary,
}) {
  const sections = [
    renderFindingsSection('🔒 Security', security),
    renderFindingsSection('🧩 Correctness / Regression', correctness),
    renderFindingsSection('⚡ Performance', performance),
    renderFindingsSection('🧪 Testing', testing),
    renderFindingsSection('🏗️ Architecture / Code Smell', architecture),
  ];

  const overallRisk = summary?.overallRisk
    ? `**${summary.overallRisk.level}** — ${summary.overallRisk.reason}`
    : '_（未提供）_';

  const mergeRecommendation = summary?.mergeRecommendation ?? '_（未提供）_';
  const guideSection = renderReviewGuide(reviewGuide);

  return [
    AI_REVIEW_COMMENT_MARKER,
    '## 🤖 AI Review Pipeline',
    '',
    plan?.requirementSummary ? `> ${plan.requirementSummary}` : '',
    '',
    guideSection ?? '### 🧭 Review Guide\n_（未執行）_',
    '',
    '---',
    '',
    sections.join('\n\n'),
    '',
    '---',
    '',
    '### 📋 Requirement Coverage',
    renderRequirementCoverage(plan, summary),
    '',
    '### ⚠️ Overall Risk',
    overallRisk,
    '',
    '### 🧪 Missing Tests',
    renderMissingTests(testing),
    '',
    '### ✅ Merge Recommendation',
    mergeRecommendation,
    '',
    '_以上意見僅供參考（advisory only），不會阻擋 merge。_',
  ].join('\n');
}
