import { schoolAliases } from './schoolAliases';

/**
 * 依據規定的 5 個步驟進行字串正規化：
 * 1. 去除所有空白字元（含全形空格）
 * 2. 全形英數 → 半形
 * 3. 英文轉小寫
 * 4. 臺 → 台
 * 5. 学 → 學
 * 為了支援簡體字「台湾大学」，在此多做一步：湾 → 灣
 */
export function normalize(input: string): string {
  // 1. 去除所有空白字元（含全形空格）
  let result = input.replace(/[\s　]+/g, '');

  // 2. 全形英數 → 半形
  result = result.replace(/[\uFF01-\uFF5E]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // 3. 英文轉小寫
  result = result.toLowerCase();

  // 4. 臺 → 台
  result = result.replace(/臺/g, '台');

  // 5. 学 → 學
  result = result.replace(/学/g, '學');

  // 額外支援簡體：湾 → 灣
  result = result.replace(/湾/g, '灣');

  return result;
}

/**
 * 判斷是否為 T1 命中（正規化後校名完全相同，或是完全等於該校任一別名的正規化結果）
 */
export function isT1Match(schoolName: string, nq: string): boolean {
  if (normalize(schoolName) === nq) {
    return true;
  }
  const aliases = schoolAliases[schoolName] || [];
  return aliases.some((alias) => normalize(alias) === nq);
}

/**
 * 尋找最佳的子序列匹配（span 最小，若 span 相同則 start 最小）
 * span = 最後命中字元索引 - 第一個命中字元索引
 * start = 第一個命中字元索引
 */
export function findBestSubsequence(
  nq: string,
  S: string
): { span: number; start: number } | null {
  const m = nq.length;
  const n = S.length;
  if (m === 0 || n === 0 || m > n) {
    return null;
  }

  let bestSpan = Infinity;
  let bestStart = Infinity;
  let found = false;

  function dfs(nqIdx: number, sIdx: number, firstIdx: number, lastIdx: number) {
    if (nqIdx === m) {
      found = true;
      const span = lastIdx - firstIdx;
      const start = firstIdx;
      if (span < bestSpan) {
        bestSpan = span;
        bestStart = start;
      } else if (span === bestSpan && start < bestStart) {
        bestStart = start;
      }
      return;
    }

    for (let i = sIdx; i < n; i++) {
      if (S[i] === nq[nqIdx]) {
        const nextFirst = nqIdx === 0 ? i : firstIdx;
        // 剪枝：如果目前的 span 已經比已知的 bestSpan 大，就不需要再往下搜尋
        if (nqIdx > 0 && i - nextFirst > bestSpan) {
          continue;
        }
        dfs(nqIdx + 1, i + 1, nextFirst, i);
      }
    }
  }

  dfs(0, 0, -1, -1);

  if (!found) {
    return null;
  }
  return { span: bestSpan, start: bestStart };
}

interface NormalizedSchool {
  school: string;
  normalized: string;
}

// Cache per input array reference so callers that pass the same static
// school list on every render don't pay for re-normalizing it each time.
// Assumes callers treat the array as immutable (no in-place push/splice) -
// true for the generated taiwanSchools list this is designed around.
const normalizedSchoolsCache = new WeakMap<string[], NormalizedSchool[]>();

function getNormalizedSchools(schools: string[]): NormalizedSchool[] {
  const cached = normalizedSchoolsCache.get(schools);
  if (cached) {
    return cached;
  }
  const normalized = schools.map((school) => ({
    school,
    normalized: normalize(school),
  }));
  normalizedSchoolsCache.set(schools, normalized);
  return normalized;
}

interface T1MatchItem {
  school: string;
  originalIndex: number;
}

interface T2MatchItem {
  school: string;
  start: number;
  originalIndex: number;
}

interface T3MatchItem {
  school: string;
  span: number;
  start: number;
  originalIndex: number;
}

/**
 * 搜尋學校純函式
 * query 為空或全空白時，回傳 schools 原始順序。
 * 否則進行 L1, L2, L3 三層過濾與排序。
 * schools 由呼叫端注入，lib 層不依賴任何特定資料來源。
 */
export function searchSchools(query: string, schools: string[]): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return schools;
  }

  const nq = normalize(trimmed);
  const normalizedSchools = getNormalizedSchools(schools);

  const t1Matches: T1MatchItem[] = [];
  const t2Matches: T2MatchItem[] = [];
  const t3Matches: T3MatchItem[] = [];

  for (let i = 0; i < normalizedSchools.length; i++) {
    const { school, normalized: sNormalized } = normalizedSchools[i];

    // 1. T1 優先權：別名／完全相同
    if (isT1Match(school, nq)) {
      t1Matches.push({ school, originalIndex: i });
      continue;
    }

    // 2. T2 優先權：子字串
    const t2Start = sNormalized.indexOf(nq);
    if (t2Start !== -1) {
      t2Matches.push({ school, start: t2Start, originalIndex: i });
      continue;
    }

    // 3. T3 優先權：子序列
    const t3Sub = findBestSubsequence(nq, sNormalized);
    if (t3Sub !== null) {
      t3Matches.push({
        school,
        span: t3Sub.span,
        start: t3Sub.start,
        originalIndex: i,
      });
      continue;
    }
  }

  // 排序
  // T1: 依 taiwanSchools 索引
  t1Matches.sort((a, b) => a.originalIndex - b.originalIndex);

  // T2: 命中起始位置 asc → taiwanSchools 索引
  t2Matches.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return a.originalIndex - b.originalIndex;
  });

  // T3: span asc → start asc → taiwanSchools 索引
  t3Matches.sort((a, b) => {
    if (a.span !== b.span) {
      return a.span - b.span;
    }
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return a.originalIndex - b.originalIndex;
  });

  return [
    ...t1Matches.map((m) => m.school),
    ...t2Matches.map((m) => m.school),
    ...t3Matches.map((m) => m.school),
  ];
}
