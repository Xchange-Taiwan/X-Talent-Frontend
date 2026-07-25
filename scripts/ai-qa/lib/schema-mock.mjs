// Safety-net baseline for the QA mock server: any endpoint the OpenAPI
// contract defines gets a plausible response even if nobody registered a
// fixture for it (see fixture-planner.mjs, which only plans fixtures for
// endpoints it spotted in the diff — it has no way to know about endpoints a
// page calls that this ticket's diff didn't touch). This layer only ever
// answers for endpoints that genuinely exist in the contract; a call to a
// path the contract doesn't define still 404s in mock-api-server.mjs, so a
// real "wrong endpoint" bug still surfaces instead of being masked.
//
// Deliberately generic, not scenario-realistic: values come from each
// field's `default` (if the schema declares one) or a type-based zero value
// (empty string, 0, false, {}). An exact-match fixture from fixture-planner
// or a scenario always takes priority over this — see mock-api-server.mjs's
// lookup order.
import { readFileSync } from 'node:fs';

const SPEC_PATH = new URL('../openapi-spec.json', import.meta.url);
const MAX_DEPTH = 6;

let cachedSpec;

function loadSpec() {
  if (cachedSpec !== undefined) return cachedSpec;
  try {
    cachedSpec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
  } catch {
    // Missing/unreadable snapshot must degrade to "no schema baseline
    // available", not crash the mock server — same never-throws contract as
    // fixture-planner.mjs.
    cachedSpec = null;
  }
  return cachedSpec;
}

function resolveRef(spec, schema) {
  if (schema && typeof schema.$ref === 'string') {
    const name = schema.$ref.split('/').pop();
    return spec.components?.schemas?.[name] ?? {};
  }
  return schema ?? {};
}

/** Samples a plausible JSON value for an OpenAPI schema fragment. Exported for unit testing. */
export function sampleSchema(spec, schemaIn, depth = 0) {
  const schema = resolveRef(spec, schemaIn);

  if (schema.anyOf || schema.oneOf) {
    const branches = schema.anyOf ?? schema.oneOf;
    const nonNull = branches.find((b) => resolveRef(spec, b).type !== 'null');
    return nonNull ? sampleSchema(spec, nonNull, depth) : null;
  }

  if ('default' in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return schema.enum[0];

  if (schema.type === 'array') {
    if (depth >= MAX_DEPTH || !schema.items) return [];
    return [sampleSchema(spec, schema.items, depth + 1)];
  }

  if (schema.properties) {
    if (depth >= MAX_DEPTH) return {};
    const obj = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      obj[key] = sampleSchema(spec, propSchema, depth + 1);
    }
    return obj;
  }

  switch (schema.type) {
    case 'string':
      return '';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'null':
      return null;
    default:
      return null;
  }
}

function pathToRegex(templatePath) {
  const parts = templatePath
    .split('/')
    .map((segment) =>
      segment.startsWith('{') && segment.endsWith('}')
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
  return new RegExp(`^${parts.join('/')}$`);
}

function findSuccessSchema(operation) {
  const responses = operation.responses ?? {};
  const code = Object.keys(responses).find((c) => c.startsWith('2'));
  if (!code) return null;
  return responses[code]?.content?.['application/json']?.schema ?? null;
}

/**
 * Matches `method`+`pathname` against the spec's path templates (the spec's
 * paths are prefixed `/api/v1/...`; the app's own apiClient calls
 * `/v1/...` — NEXT_PUBLIC_API_URL already carries the `/api` in production,
 * but during QA it points straight at the mock server) and returns
 * `{ status, body }` sampled from that operation's 2xx response schema, or
 * `null` if the contract has no matching path+method+response. Exported for
 * unit testing against a hand-built spec.
 */
export function findSchemaFixture(spec, method, pathname) {
  if (!spec?.paths) return null;
  const verb = method.toLowerCase();

  for (const [specPath, pathItem] of Object.entries(spec.paths)) {
    const normalizedPath = specPath.replace(/^\/api(?=\/)/, '');
    if (!pathToRegex(normalizedPath).test(pathname)) continue;

    const operation = pathItem[verb];
    if (!operation) continue;

    const responseSchema = findSuccessSchema(operation);
    if (!responseSchema) continue;

    return { status: 200, body: sampleSchema(spec, responseSchema) };
  }
  return null;
}

/** Loads the checked-in OpenAPI snapshot (scripts/ai-qa/openapi-spec.json) and looks up a fixture. */
export function getSchemaMockFixture(method, pathname) {
  const spec = loadSpec();
  if (!spec) return null;
  return findSchemaFixture(spec, method, pathname);
}
