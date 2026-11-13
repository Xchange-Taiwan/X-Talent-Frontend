export const AI_REVIEW_COMMENT_MARKER = '<!-- ai-review-pipeline -->';

function renderFindingsSection(title, result) {
  if (!result) {
    return `### ${title}\n_（未執行）_`;
  }
  if (result.skippedDueToError) {
    return `### ${title}\n⚠️ ${result.summary || '審查因暫時性錯誤略過'}`;
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

function isOutOfRepoCriterion(entry) {
  const scope = String(entry?.scope ?? '')
    .toLowerCase()
    .trim();
  return (
    scope === 'out_of_repo' ||
    scope === 'backend' ||
    scope === 'external' ||
    entry?.applicableToFrontend === false
  );
}

function renderRequirementCoverage(plan, summary) {
  const coverageList = Array.isArray(summary?.requirementCoverage)
    ? summary.requirementCoverage
    : [];
  const planFrontendCriteria = Array.isArray(plan?.acceptanceCriteria)
    ? plan.acceptanceCriteria
    : [];
  const planOutOfRepo = Array.isArray(plan?.outOfRepoCriteria)
    ? plan.outOfRepoCriteria
    : [];

  if (coverageList.length > 0 || planOutOfRepo.length > 0) {
    const seen = new Set();
    const rows = [];

    if (coverageList.length === 0 && planFrontendCriteria.length > 0) {
      for (const rawCrit of planFrontendCriteria) {
        const crit = String(rawCrit ?? '').trim();
        if (!crit || seen.has(crit)) continue;
        seen.add(crit);
        rows.push(`- ⚠️ ${crit} — 無法判斷（Summary 未回傳覆蓋結果）`);
      }
    }

    for (const c of coverageList) {
      const crit = String(c?.criterion ?? '').trim();
      if (!crit) continue;
      seen.add(crit);
      if (isOutOfRepoCriterion(c)) {
        rows.push(
          `- ⏭️ ${crit} — ${c.note || '屬後端或外部系統範圍，本前端 PR 豁免檢查'}`
        );
      } else {
        rows.push(
          `- ${c.covered ? '✅' : '⚠️'} ${crit}${c.note ? ` — ${c.note}` : ''}`
        );
      }
    }

    for (const rawCrit of planOutOfRepo) {
      const crit = String(rawCrit ?? '').trim();
      if (!crit || seen.has(crit)) continue;
      seen.add(crit);
      rows.push(`- ⏭️ ${crit} — 屬後端或外部系統範圍，本前端 PR 豁免檢查`);
    }

    if (rows.length > 0) {
      return rows.join('\n');
    }
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
  if (reviewGuide.skippedDueToError) {
    return `### 🧭 Review Guide\n⚠️ ${reviewGuide.summary || '導讀產生因暫時性錯誤略過'}`;
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
export function resolveOverallRiskWithFailClosed({
  summary,
  security,
  correctness,
  businessLogic,
  visualParity,
  performance,
  testing,
  architecture,
}) {
  const coreEntries = [
    ['Security', security],
    ['Correctness / Regression', correctness],
    ['Business Logic / Requirements', businessLogic],
    ...(visualParity !== undefined
      ? [['Visual / Design Parity', visualParity]]
      : []),
    ['Performance', performance],
    ['Testing', testing],
    ['Architecture / Code Smell', architecture],
  ];

  const degradedDomains = coreEntries
    .filter(([, stage]) => stage?.skippedDueToError === true)
    .map(([label]) => label);

  if (!summary?.overallRisk) {
    if (degradedDomains.length > 0) {
      return {
        level: 'medium',
        reason: `核心審查領域因錯誤略過（${degradedDomains.join('、')}），系統強制標記為 medium 防止漏審放行`,
      };
    }
    return null;
  }

  const rawLevel = String(summary.overallRisk.level ?? '')
    .toLowerCase()
    .trim();
  const rawReason = String(summary.overallRisk.reason ?? '').trim();

  if (degradedDomains.length > 0) {
    const elevatedLevel = rawLevel === 'high' ? 'high' : 'medium';
    const prefix = `核心審查領域因錯誤略過（${degradedDomains.join('、')}），系統強制提升風險等級防止漏審放行`;
    return {
      level: elevatedLevel,
      reason: rawReason ? `${prefix}；${rawReason}` : prefix,
    };
  }

  return {
    level: rawLevel || 'medium',
    reason: rawReason,
  };
}

export function formatComment({
  plan,
  reviewGuide,
  security,
  correctness,
  businessLogic,
  visualParity,
  performance,
  testing,
  architecture,
  summary,
  headSha = '',
}) {
  const sections = [
    renderFindingsSection('🧭 Business Logic / Requirements', businessLogic),
    ...(visualParity !== undefined
      ? [renderFindingsSection('🎨 Visual / Design Parity', visualParity)]
      : []),
    renderFindingsSection('🔒 Security', security),
    renderFindingsSection('🧩 Correctness / Regression', correctness),
    renderFindingsSection('⚡ Performance', performance),
    renderFindingsSection('🧪 Testing', testing),
    renderFindingsSection('🏗️ Architecture / Code Smell', architecture),
  ];

  const effectiveRisk = resolveOverallRiskWithFailClosed({
    summary,
    security,
    correctness,
    businessLogic,
    visualParity,
    performance,
    testing,
    architecture,
  });
  const overallRisk = effectiveRisk
    ? `**${effectiveRisk.level}** — ${effectiveRisk.reason}`
    : '_（未提供）_';

  const mergeRecommendation = summary?.mergeRecommendation ?? '_（未提供）_';
  const guideSection = renderReviewGuide(reviewGuide);
  const shaMarker = headSha
    ? `<!-- ai-review-sha:${String(headSha).trim()} -->`
    : '';

  return [
    shaMarker
      ? `${AI_REVIEW_COMMENT_MARKER}\n${shaMarker}`
      : AI_REVIEW_COMMENT_MARKER,
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
