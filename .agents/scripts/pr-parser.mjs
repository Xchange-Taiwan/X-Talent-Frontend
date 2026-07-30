/**
 * PR Check State Parsing and Timeout helpers for monitor-pr.mjs
 */

export function categorizeChecks(checks = []) {
  const passing = [];
  const pending = [];
  const failing = [];

  for (const check of checks) {
    const bucket = (check.bucket || "").toLowerCase();
    const state = (check.state || "").toLowerCase();

    if (bucket === "pass" || state === "success" || bucket === "skipping") {
      passing.push(check);
    } else if (bucket === "pending" || state === "pending" || state === "in_progress" || state === "queued") {
      pending.push(check);
    } else {
      failing.push(check);
    }
  }

  return { passing, pending, failing };
}

export function isTimeout(startTime, maxTimeout, currentTime = Date.now()) {
  const elapsed = currentTime - startTime;
  return elapsed > maxTimeout;
}

/**
 * Filter out ignored checks (e.g. Vercel deployment limits check failures)
 */
export function filterIgnoredChecks(failingChecks = []) {
  const critical = [];
  const ignored = [];

  for (const check of failingChecks) {
    const name = (check.name || "").toLowerCase();
    if (name.includes("vercel") || name.includes("preview")) {
      ignored.push(check);
    } else {
      critical.push(check);
    }
  }

  return { critical, ignored };
}

/**
 * Parse AI reviewer comments or reviews on the PR to detect critical findings
 */
export function parseAIReviewComments(comments = [], reviews = []) {
  const aiFindings = [];
  const allComments = Array.isArray(comments) ? [...comments] : [];
  
  if (Array.isArray(reviews)) {
    for (const r of reviews) {
      allComments.push({
        body: r.body,
        author: r.author,
        url: r.url
      });
    }
  }

  for (const c of allComments) {
    const body = c.body || "";
    if (
      body.includes("🤖 AI Review") || 
      body.includes("ai-review-pipeline") || 
      body.includes("AI Review Pipeline")
    ) {
      // Extract Overall Risk
      let risk = "unknown";
      // Support matching formats like: "### ⚠️ Overall   Risk\n**high**" or "Overall Risk\n**high**"
      const riskMatch = body.match(/Overall\s*Risk\s*\n\s*\*\*([^*]+)\*\*/i);
      if (riskMatch) {
        risk = riskMatch[1].trim().toLowerCase();
      }

      // Extract bullet point issues
      const issues = [];
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("- **[")) {
          let description = "";
          // Extract the explanation block if available
          if (lines[i + 1] && lines[i + 1].trim().startsWith(">")) {
            description = lines[i + 1].trim();
          }
          issues.push({ issue: line, description });
        }
      }

      aiFindings.push({
        author: c.author?.login || "unknown",
        risk,
        issues,
        url: c.url || ""
      });
    }
  }

  return aiFindings;
}
