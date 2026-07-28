---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker — edges as text in one file per ticket locally, or native blocking links on a real tracker.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it.

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket — green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to the configured tracker

Publish the approved tickets. **How** depends on the tracker `/setup-matt-pocock-skills` configured — the tickets are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-ticket file template below — one ticket per file, never a single combined file.
- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each ticket's "Blocked by" to the blocking issues. Apply the `ready-for-agent` triage label unless instructed otherwise — the tickets are agent-grabbable by construction.

  **Automated Project Board Addition & Backlog Assignment Flow**:
  For GitHub issue tracking, after creating each issue, dynamically add it to the project board and move its status to "Backlog" using the parsed configuration:
  1. **Fetch and Parse Configuration**:
     - **On macOS/Linux (Bash/Zsh)**:

       ````bash
       # Fetch config file from tracker repository (using main branch)
       CONFIG_MD=$(gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>/dev/null)

       # Fallback to local file if fetch failed
       if [ -z "$CONFIG_MD" ]; then
         if [ -f "docs/agents/project-config.md" ]; then
           CONFIG_MD=$(cat docs/agents/project-config.md)
         fi
       fi

       # Check if config content is present
       if [ -z "$CONFIG_MD" ]; then
         echo "ERROR: project-config.md not found or malformed — aborting to avoid null ID API calls" >&2
         exit 1
       fi

       # Extract and parse JSON
       CONFIG_JSON=$(echo "$CONFIG_MD" | sed -n '/^```json/,/^```$/p' | sed '1d;$d')
       ORG=$(echo "$CONFIG_JSON" | jq -r '.org')
       TRACKER_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.tracker')
       FRONTEND_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.frontend')
       PROJECT_NUMBER=$(echo "$CONFIG_JSON" | jq -r '.project.number')
       PROJECT_ID=$(echo "$CONFIG_JSON" | jq -r '.project.id')
       FIELD_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.id')
       BACKLOG_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.backlog')
       PR_REVIEW_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.pr_review')
       ````

     - **On Windows (PowerShell)**:

       ````powershell
       # Fetch config file from tracker repository (using main branch)
       $CONFIG_MD = (gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>$null)

       # Fallback to local file if fetch failed
       if (-not $CONFIG_MD -and (Test-Path "docs/agents/project-config.md")) {
         $CONFIG_MD = (Get-Content -Raw -Path "docs/agents/project-config.md")
       }

       # Check if config content is present
       if (-not $CONFIG_MD) {
         Write-Error "ERROR: project-config.md not found or malformed — aborting to avoid null ID API calls"
         exit 1
       }

       # Extract and parse JSON
       $CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value
       $CONFIG_JSON = ConvertFrom-Json $CONFIG_JSON_STRING
       $ORG = $CONFIG_JSON.org
       $TRACKER_REPO = $CONFIG_JSON.repos.tracker
       $FRONTEND_REPO = $CONFIG_JSON.repos.frontend
       $PROJECT_NUMBER = $CONFIG_JSON.project.number
       $PROJECT_ID = $CONFIG_JSON.project.id
       $FIELD_ID = $CONFIG_JSON.fields.status.id
       $BACKLOG_OPTION_ID = $CONFIG_JSON.fields.status.options.backlog
       $PR_REVIEW_OPTION_ID = $CONFIG_JSON.fields.status.options.pr_review
       ````

  2. **Create Issue and Programmatically Add & Move to Backlog**:
     For each ticket:
     - **On macOS/Linux (Bash/Zsh)**:

       ```bash
       # 1. Create the issue and retrieve its node ID
       ISSUE_NODE_ID=$(gh issue create --title "$TICKET_TITLE" --body "$TICKET_BODY" --repo "$ORG/$TRACKER_REPO" --label "ai-review" --json id --jq '.id')

       if [ -n "$ISSUE_NODE_ID" ]; then
         # 2. Add issue to Project Board
         ITEM_ID=$(gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
           mutation($project_id: ID!, $content_id: ID!) {
             addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
               item { id }
             }
           }
         ' --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null)

         if [ -n "$ITEM_ID" ]; then
           # 3. Update Status Field to Backlog
           gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$BACKLOG_OPTION_ID" -f query='
             mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
               updateProjectV2ItemFieldValue(
                 input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
               ) { projectV2Item { id } }
             }
           ' >/dev/null

           if [ $? -ne 0 ]; then
             echo "WARNING: Failed to move issue to Backlog. Please manually move it on the board." >&2
           fi
         else
           echo "WARNING: Failed to add issue to Project Board. Please manually link it." >&2
         fi
       else
         echo "ERROR: Failed to create issue '$TICKET_TITLE'." >&2
       fi

       # 4. API Rate Limit Mitigation (sleep 1 second between batch ticket additions)
       sleep 1
       ```

     - **On Windows (PowerShell)**:

       ```powershell
       # 1. Create the issue and retrieve its node ID
       $ISSUE_NODE_ID = (gh issue create --title "$TICKET_TITLE" --body "$TICKET_BODY" --repo "$ORG/$TRACKER_REPO" --label "ai-review" --json id --jq '.id')

       if ($ISSUE_NODE_ID) {
         # 2. Add issue to Project Board
         $ITEM_ID = (gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
           mutation($project_id: ID!, $content_id: ID!) {
             addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
               item { id }
             }
           }
         ' --jq '.data.addProjectV2ItemById.item.id' 2>$null)

         if ($ITEM_ID) {
           # 3. Update Status Field to Backlog
           gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$BACKLOG_OPTION_ID" -f query='
             mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
               updateProjectV2ItemFieldValue(
                 input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
               ) { projectV2Item { id } }
             }
           ' | Out-Null

           if ($LastExitCode -ne 0) {
             Write-Warning "WARNING: Failed to move issue to Backlog. Please manually move it on the board."
           }
         } else {
           Write-Warning "WARNING: Failed to add issue to Project Board. Please manually link it."
         }
       } else {
         Write-Error "ERROR: Failed to create issue '$TICKET_TITLE'."
       }

       # 4. API Rate Limit Mitigation (sleep 1 second between batch ticket additions)
       Start-Sleep -Seconds 1
       ```

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

<local-ticket-template>

# <NN> — <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective — not a layer-by-layer implementation list.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None — can start immediately".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

</local-ticket-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None — can start immediately".

</issue-template>

In either form, avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.
