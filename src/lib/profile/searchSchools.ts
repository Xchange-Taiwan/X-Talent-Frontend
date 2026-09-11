import { schoolAliases } from './schoolAliases';

// Precomputed once at module load since schoolAliases is static, self-owned
// data (not fetched or mutated at runtime).
const normalizedAliasesBySchool: Record<string, string[]> = Object.fromEntries(
  Object.entries(schoolAliases).map(([school, aliases]) => [
    school,
    aliases.map((alias) => normalize(alias)),
  ])
);

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
 * normalizedSchoolName 可選：呼叫端若已算過 normalize(schoolName)，傳入以避免重算。
 */
export function isT1Match(
  schoolName: string,
  nq: string,
  normalizedSchoolName?: string
): boolean {
  const sNormalized = normalizedSchoolName ?? normalize(schoolName);
  if (sNormalized === nq) {
    return true;
  }
  const aliases = normalizedAliasesBySchool[schoolName] || [];
  return aliases.some((alias) => alias === nq);
}

/**
 * 尋找最佳的子序列匹配（span 最小，若 span 相同則 start 最小）
 * span = 最後命中字元索引 - 第一個命中字元索引
 * start = 第一個命中字元索引
 *
 * 使用線性掃描（O(n) amortized），而非窮舉所有子序列組合的寫法——後者在字元大量
 * 重複時（例如查詢「大大大」比對含多個「大」的校名）會產生指數級的分支。
 * 作法：每輪從目前起點正向掃出「最早完成匹配」的結尾位置，再從該結尾反向掃出
 * 對應的最緊起點，取所有輪次中 span 最小者；下一輪從該起點之後重新開始，
 * 確保 i 只會單調前進，整體維持線性時間。
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

  let bestStart = -1;
  let bestLength = Infinity;

  let i = 0;
  while (i < n) {
    // 正向掃描：從 i 開始找出最早能完成 nq 全部字元匹配的結尾位置
    let j = 0;
    let k = i;
    while (k < n && j < m) {
      if (S[k] === nq[j]) {
        j++;
      }
      k++;
    }
    if (j < m) {
      break;
    }
    const end = k - 1;

    // 反向掃描：從 end 往回找出對應這個結尾的最緊起點
    let start = end;
    let jj = m - 1;
    for (let p = end; p >= i; p--) {
      if (S[p] === nq[jj]) {
        jj--;
        if (jj < 0) {
          start = p;
          break;
        }
      }
    }

    const length = end - start + 1;
    if (length < bestLength) {
      bestLength = length;
      bestStart = start;
    }

    i = start + 1;
  }

  if (bestStart === -1) {
    return null;
  }
  return { span: bestLength - 1, start: bestStart };
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
    if (isT1Match(school, nq, sNormalized)) {
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

/**
 * 判斷 query 是否對 schools 中任一校產生 T1（別名／完全相同）命中。
 * 供 UI 判斷 creatable「新增」選項是否顯示，避免 UI 元件自行 import
 * normalize/isT1Match 並重新遍歷整個 schools 陣列。
 */
export function hasExactMatch(query: string, schools: string[]): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }

  const nq = normalize(trimmed);
  const normalizedSchools = getNormalizedSchools(schools);
  return normalizedSchools.some(({ school, normalized }) =>
    isT1Match(school, nq, normalized)
  );
}
