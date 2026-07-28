# AI Agent Project Configuration

This file centralizes all GitHub project board, repository, and status option identifiers to adhere to the DRY principle.
Do not modify the JSON structure below without coordinating with the engineering team, as custom agent skills depend on it.

## How to Retrieve These IDs (ID 取得教學)

If the project configuration needs to be updated or migrated, you can query these IDs using the GitHub CLI with the following GraphQL commands:

1. **Query Project V2 Node ID, Fields, and Single-Select Options:**
   ```bash
   gh api graphql -F login="Xchange-Taiwan" -F project_number=7 -f query='
     query($login: String!, $project_number: Int!) {
       organization(login: $login) {
         projectV2(number: $project_number) {
           id
           title
           fields(first: 20) {
             nodes {
               ... on ProjectV2FieldCommon {
                 id
                 name
               }
               ... on ProjectV2SingleSelectField {
                 id
                 name
                 options {
                   id
                   name
                 }
               }
             }
           }
         }
       }
     }
   '
   ```

---

## Centralized Configuration JSON

Below is the fenced JSON block containing the configuration variables. Custom agent skills (`/start-ticket`, `/submit-pr`, `/to-tickets`) read this JSON block dynamically.

```json
{
  "org": "Xchange-Taiwan",
  "repos": {
    "tracker": "X-Talent-Tracker",
    "frontend": "X-Talent-Frontend"
  },
  "project": {
    "number": 7,
    "id": "PVT_kwDOBFpxMc4BULhh"
  },
  "fields": {
    "status": {
      "id": "PVTSSF_lADOBFpxMc4BULhhzhBVb_Y",
      "options": {
        "backlog": "79bd68fc",
        "in_progress": "47fc9ee4",
        "pr_review": "013ebc9d"
      }
    }
  }
}
```
