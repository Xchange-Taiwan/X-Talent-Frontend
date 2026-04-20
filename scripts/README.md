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
