# scripts/

## generate-types.mjs

Reads `BFF_OPENAPI_URL` from `.env` / `.env.development.local` and generates `src/types/api.ts`.

### Setup

Add to your `.env.development.local`:

```
BFF_OPENAPI_URL=<BFF openapi.json URL>
```

### How to update types

```bash
pnpm generate:types
```

Commit the updated `src/types/api.ts` whenever the BFF schema changes.

## generate-school-list.mjs

Reads `scripts/data/moe-university-directory.json` (Ministry of Education 大專校院名錄 open data) and generates `src/components/profile/edit/educationSection/schoolData.ts` — the school list behind the education section's "學校名稱" combobox.

Only the latest academic year in the dataset is used: a school is included if and only if it appears in that year's rows, under whatever name it's listed under that year (a rename shows up automatically; a closed school drops out automatically).

The upstream feed carries ~13 academic years of history (1900+ rows), but only the latest year is ever used. To keep the repo from re-accumulating that history every time someone refreshes the data, `pnpm generate:schools` also prunes the committed `scripts/data/moe-university-directory.json` down to just the latest year's rows as a side effect — the checked-in file is always a single-year snapshot, not the full historical feed.

### How to update the school list

1. Re-download the (full, multi-year) source data over `scripts/data/moe-university-directory.json`:
   ```bash
   curl -o scripts/data/moe-university-directory.json https://stats.moe.gov.tw/files/opendata/u1_new.json
   ```
2. Regenerate and commit the result — this both rewrites `schoolData.ts` and prunes the source data file back down to the latest year:
   ```bash
   pnpm generate:schools
   ```

`pnpm generate:schools:check` fails if the committed `schoolData.ts` has drifted from the committed source data (e.g. someone hand-edited it). It does not re-check the pruning step, since `--check` is read-only by design.
