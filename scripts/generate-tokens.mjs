import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTailwindColors,
  colorTokenGroups,
  rawColors,
  renderTokensCss,
  semanticColorTokens,
} from '../src/design/tokens/color-values.ts';
import tailwindConfig from '../tailwind.config.js';

const TOKENS_CSS_PATH = path.resolve('src/styles/tokens.css');
const GLOBAL_CSS_PATH = path.resolve('src/styles/global.css');
const RETIRED_COLOR_TS_PATH = path.resolve('src/design/tokens/color.ts');

const TAILWIND_CSS_KEYWORDS = new Set(['transparent', 'currentColor']);
const TAILWIND_ALPHA_COLOR_PATTERN =
  /^hsl\(var\(--([a-z0-9]+(?:-[a-z0-9]+)*)\) \/ <alpha-value>\)$/;

export function normalizeCSS(str) {
  return String(str ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function stripCssComments(css) {
  return String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function generateCSS(groups = colorTokenGroups) {
  return renderTokensCss(groups);
}

export function extractTokensCssVariables(tokensCssContent) {
  const uncommented = stripCssComments(tokensCssContent);
  const variables = new Map();
  const duplicateKeys = [];

  const declRegex = /--color-([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g;
  let match = declRegex.exec(uncommented);
  while (match !== null) {
    const [, key, rawVal] = match;
    if (variables.has(key)) {
      duplicateKeys.push(key);
    }
    variables.set(key, rawVal.trim());
    match = declRegex.exec(uncommented);
  }

  return { variables, duplicateKeys };
}

export function extractGlobalCssColorMetadata(globalCssContent) {
  const uncommented = stripCssComments(globalCssContent);
  const rootDeclarations = new Map();
  const colorVarReferences = new Set();

  const refRegex = /var\(\s*--color-([a-zA-Z0-9_-]+)\s*\)/g;
  let refMatch = refRegex.exec(uncommented);
  while (refMatch !== null) {
    colorVarReferences.add(refMatch[1]);
    refMatch = refRegex.exec(uncommented);
  }

  let cursor = 0;
  while (cursor < uncommented.length) {
    const rootIndex = uncommented.indexOf(':root', cursor);
    if (rootIndex === -1) {
      break;
    }
    const openBrace = uncommented.indexOf('{', rootIndex);
    if (openBrace === -1) {
      break;
    }
    let depth = 1;
    let i = openBrace + 1;
    while (i < uncommented.length && depth > 0) {
      if (uncommented[i] === '{') {
        depth += 1;
      } else if (uncommented[i] === '}') {
        depth -= 1;
      }
      i += 1;
    }
    if (depth === 0) {
      const rootBody = uncommented.slice(openBrace + 1, i - 1);
      const declRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([\s\S]*?);/g;
      let declMatch = declRegex.exec(rootBody);
      while (declMatch !== null) {
        const [, varName, rawValue] = declMatch;
        rootDeclarations.set(varName, rawValue.replace(/\s+/g, ' ').trim());
        declMatch = declRegex.exec(rootBody);
      }
    }
    cursor = i;
  }

  return { rootDeclarations, colorVarReferences };
}

export function flattenTailwindColorScale(scale, prefix = []) {
  const entries = new Map();
  if (!scale || typeof scale !== 'object') {
    return entries;
  }

  for (const [key, value] of Object.entries(scale)) {
    const nextPath = [...prefix, key];
    if (typeof value === 'string') {
      entries.set(nextPath.join('.'), value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenTailwindColorScale(value, nextPath);
      for (const [nestedKey, nestedValue] of nested.entries()) {
        entries.set(nestedKey, nestedValue);
      }
    } else {
      entries.set(nextPath.join('.'), String(value));
    }
  }

  return entries;
}

export function verifyTokenParity({
  tokensCss,
  globalCss,
  tailwindColors = tailwindConfig.theme?.colors,
  groups = colorTokenGroups,
  rawColorMap,
  semanticTokens = semanticColorTokens,
  retiredColorTsExists = false,
} = {}) {
  const errors = [];

  if (retiredColorTsExists) {
    errors.push(
      'Retired duplicate color map src/design/tokens/color.ts still exists; use buildTailwindColors() from src/design/tokens/color-values.ts instead.'
    );
  }

  let expectedTokensCss = '';
  let expectedTailwindColors = null;

  try {
    expectedTokensCss = renderTokensCss(groups);
  } catch (err) {
    errors.push(`Canonical token CSS build failed: ${err.message}`);
  }

  try {
    expectedTailwindColors = buildTailwindColors({ groups, semanticTokens });
  } catch (err) {
    errors.push(`Canonical Tailwind color build failed: ${err.message}`);
  }

  const effectiveRawMap =
    rawColorMap ??
    Object.fromEntries(
      groups.flatMap((group) =>
        Object.entries(group.tokens).map(([key, def]) => [key, def.hsl])
      )
    );

  // 1. Verify src/styles/tokens.css parity against canonical registry
  if (
    expectedTokensCss &&
    normalizeCSS(tokensCss) !== normalizeCSS(expectedTokensCss)
  ) {
    errors.push(
      'src/styles/tokens.css does not match canonical renderTokensCss() output.'
    );
  }

  const { variables: tokensCssVars, duplicateKeys } =
    extractTokensCssVariables(tokensCss);

  for (const dupKey of duplicateKeys) {
    errors.push(
      `src/styles/tokens.css declares duplicate custom property "--color-${dupKey}".`
    );
  }

  for (const [key, expectedHsl] of Object.entries(effectiveRawMap)) {
    if (!tokensCssVars.has(key)) {
      errors.push(
        `src/styles/tokens.css is missing canonical custom property "--color-${key}".`
      );
    } else if (tokensCssVars.get(key) !== expectedHsl) {
      errors.push(
        `src/styles/tokens.css value mismatch for "--color-${key}": expected "${expectedHsl}", received "${tokensCssVars.get(key)}".`
      );
    }
  }

  for (const key of tokensCssVars.keys()) {
    if (!(key in effectiveRawMap)) {
      errors.push(
        `src/styles/tokens.css contains unbacked custom property "--color-${key}" not present in canonical registry.`
      );
    }
  }

  // 2. Verify src/styles/global.css semantic CSS variables against canonical registry
  const { rootDeclarations, colorVarReferences } =
    extractGlobalCssColorMetadata(globalCss);

  for (const [semanticKey, semanticDef] of Object.entries(semanticTokens)) {
    const expectedAlias = `var(--color-${semanticDef.aliasOf})`;
    const actualValue = rootDeclarations.get(semanticKey);
    if (actualValue === undefined) {
      errors.push(
        `src/styles/global.css :root is missing semantic color variable "--${semanticKey}" (expected "${expectedAlias}").`
      );
    } else if (actualValue !== expectedAlias) {
      errors.push(
        `src/styles/global.css semantic variable "--${semanticKey}" drifted: expected "${expectedAlias}", received "${actualValue}".`
      );
    }
  }

  for (const [varName, value] of rootDeclarations.entries()) {
    const directAliasMatch = value.match(
      /^var\(\s*--color-([a-zA-Z0-9_-]+)\s*\)$/
    );
    if (directAliasMatch && !(varName in semanticTokens)) {
      errors.push(
        `src/styles/global.css declares unregistered semantic color alias "--${varName}: ${value}" missing from semanticColorTokens.`
      );
    }
  }

  for (const referencedRawKey of colorVarReferences) {
    if (!(referencedRawKey in effectiveRawMap)) {
      errors.push(
        `src/styles/global.css references unknown color token "var(--color-${referencedRawKey})".`
      );
    }
  }

  // 3. Verify tailwind.config.js theme.colors parity and <alpha-value> support
  if (!tailwindColors || typeof tailwindColors !== 'object') {
    errors.push('tailwind.config.js theme.colors is missing or invalid.');
  } else if (expectedTailwindColors) {
    const actualFlat = flattenTailwindColorScale(tailwindColors);
    const expectedFlat = flattenTailwindColorScale(expectedTailwindColors);

    for (const [colorPath, expectedValue] of expectedFlat.entries()) {
      if (!actualFlat.has(colorPath)) {
        errors.push(
          `tailwind.config.js theme.colors is missing expected color key "${colorPath}".`
        );
      } else if (actualFlat.get(colorPath) !== expectedValue) {
        errors.push(
          `tailwind.config.js theme.colors mismatch at "${colorPath}": expected "${expectedValue}", received "${actualFlat.get(colorPath)}".`
        );
      }
    }

    for (const [colorPath, actualValue] of actualFlat.entries()) {
      if (!expectedFlat.has(colorPath)) {
        errors.push(
          `tailwind.config.js theme.colors contains unexpected color key "${colorPath}" ("${actualValue}") not generated by buildTailwindColors().`
        );
      }

      if (TAILWIND_CSS_KEYWORDS.has(actualValue)) {
        continue;
      }

      const alphaMatch = actualValue.match(TAILWIND_ALPHA_COLOR_PATTERN);
      if (!alphaMatch) {
        errors.push(
          `tailwind.config.js theme.colors["${colorPath}"] = "${actualValue}" is missing "/ <alpha-value>" HSL opacity modifier support.`
        );
        continue;
      }

      const cssVarName = alphaMatch[1];
      if (cssVarName.startsWith('color-')) {
        const rawKey = cssVarName.slice('color-'.length);
        if (!(rawKey in effectiveRawMap) || !tokensCssVars.has(rawKey)) {
          errors.push(
            `tailwind.config.js theme.colors["${colorPath}"] references unbacked raw CSS variable "--${cssVarName}".`
          );
        }
      } else if (
        !(cssVarName in semanticTokens) ||
        !rootDeclarations.has(cssVarName)
      ) {
        errors.push(
          `tailwind.config.js theme.colors["${colorPath}"] references unbacked semantic CSS variable "--${cssVarName}".`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function main() {
  const isCheckMode = process.argv.includes('--check');

  if (!isCheckMode) {
    const generatedCSS = generateCSS();
    fs.writeFileSync(TOKENS_CSS_PATH, generatedCSS, 'utf8');
    console.log(`Successfully generated CSS tokens at ${TOKENS_CSS_PATH}`);
  }

  if (!fs.existsSync(TOKENS_CSS_PATH)) {
    console.error(`Error: Generated CSS file not found at ${TOKENS_CSS_PATH}`);
    console.error(
      "Please run 'pnpm generate:tokens' locally and commit the result."
    );
    process.exit(1);
  }

  if (!fs.existsSync(GLOBAL_CSS_PATH)) {
    console.error(`Error: Global CSS file not found at ${GLOBAL_CSS_PATH}`);
    process.exit(1);
  }

  if (isCheckMode && fs.existsSync(RETIRED_COLOR_TS_PATH)) {
    console.error(
      `Error: Retired duplicate color map still exists at ${RETIRED_COLOR_TS_PATH}.`
    );
    console.error(
      'Use buildTailwindColors() from src/design/tokens/color-values.ts instead.'
    );
    process.exit(1);
  }

  const tokensCss = fs.readFileSync(TOKENS_CSS_PATH, 'utf8');
  const globalCss = fs.readFileSync(GLOBAL_CSS_PATH, 'utf8');

  const parity = verifyTokenParity({
    tokensCss,
    globalCss,
    tailwindColors: tailwindConfig.theme?.colors,
    groups: colorTokenGroups,
    rawColorMap: rawColors,
    semanticTokens: semanticColorTokens,
    retiredColorTsExists: fs.existsSync(RETIRED_COLOR_TS_PATH),
  });

  if (!parity.ok) {
    console.error(
      '========================================================================'
    );
    console.error('Error: Design token parity drift detected:');
    for (const err of parity.errors) {
      console.error(`  - ${err}`);
    }
    console.error(
      "Please update 'src/design/tokens/color-values.ts', run 'pnpm generate:tokens', and commit the result."
    );
    console.error(
      '========================================================================'
    );
    process.exit(1);
  }

  if (isCheckMode) {
    console.log('Design tokens parity check passed. No drift detected.');
  }
  process.exit(0);
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution && !process.env.VITEST) {
  main();
}
