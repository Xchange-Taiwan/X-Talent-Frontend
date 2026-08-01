import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Grid,
  List,
  Search,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { rawColors } from '../design/tokens/color-values';

interface ColorToken {
  key: string;
  name: string;
  hex: string;
  hsl: string;
  variable: string;
  tailwindBg: string;
  tailwindText: string;
}

interface ColorGroup {
  title: string;
  description: string;
  tokens: ColorToken[];
}

// Helper to convert HSL string to HEX string
export function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length < 3) return '#000000';
  const hRaw = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace('%', '')) / 100;
  const l = parseFloat(parts[2].replace('%', '')) / 100;

  // Handle h=360 or wrapping correctly
  const h = hRaw % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rHex = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, '0');
  const gHex = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, '0');
  const bHex = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

// Map legacy color keys to camelCase in Tailwind
const legacyKeyMap: Record<string, string> = {
  'logo-blue': 'logoBlue',
  'bd-blue': 'bdBlue',
  'marketing-orange': 'marketingOrange',
  'landing-purple-light': 'landingPurpleLight',
};

// Convert raw colors into our ColorToken list dynamically
const allTokens: ColorToken[] = Object.entries(rawColors).map(
  ([key, hslVal]) => {
    // Determine CSS variable name
    const variable = `--color-${key}`;

    // Name representation
    const name = key
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Mapping to Tailwind bg/text classes (accounting for camelCase legacy names)
    const tailwindKey = legacyKeyMap[key] || key;
    const twBg = `bg-${tailwindKey}`;
    const twText = `text-${tailwindKey}`;

    return {
      key,
      name,
      hex: hslToHex(hslVal),
      hsl: hslVal,
      variable,
      tailwindBg: twBg,
      tailwindText: twText,
    };
  }
);

// Group the dynamically built tokens into categories
const colorGroups: ColorGroup[] = [
  {
    title: 'Brand Colors (品牌色系)',
    description:
      'X-Talent 核心品牌色系，使用在主要按鈕、焦點視覺、進度條、連結與高亮元素。',
    tokens: allTokens.filter((t) => t.key.startsWith('brand-')),
  },
  {
    title: 'Gray Scale (中性灰階)',
    description: '基礎灰階色，主要用於邊框、次要背景、區隔線與次要卡片背景。',
    tokens: allTokens.filter((t) => t.key.startsWith('gray-')),
  },
  {
    title: 'Text System (文字系統)',
    description: '嚴格規範頁面內各層級文字的顏色，以確保良好的對比度與易讀性。',
    tokens: allTokens.filter((t) => t.key.startsWith('text-')),
  },
  {
    title: 'Background System (背景與邊框系統)',
    description: '定義頁面背景底色、卡片與元件背景，以及系統基礎邊框線顏色。',
    tokens: allTokens.filter((t) => t.key.startsWith('background-')),
  },
  {
    title: 'Status Colors (狀態色系)',
    description: '用於表示系統反饋（成功、錯誤、警告、資訊）的提示色。',
    tokens: allTokens.filter((t) => t.key.startsWith('status-')),
  },
  {
    title: 'Interactive & Accent Colors (動態互動與輔助色)',
    description: '主要用於特定導師領域標籤、卡片點綴、或互動反饋元件。',
    tokens: allTokens.filter(
      (t) =>
        (t.key.endsWith('-default') && !t.key.startsWith('status-')) ||
        (t.key.endsWith('-active') && !t.key.startsWith('status-')) ||
        t.key === 'light' ||
        t.key === 'dark'
    ),
  },
  {
    title: 'Avatar Elements (頭像與外框設計)',
    description: '專用於個人頭像背景、外框描邊、及頭像上方疊加層遮罩設計。',
    tokens: allTokens.filter((t) => t.key.startsWith('avatar-')),
  },
  {
    title: 'Legacy & Landing Page Specific (行銷落地方案舊有色系)',
    description:
      '保留給 Landing 頁面與傳統導師分類、BD 部門使用的色值。維持此系列以確保落地位點相容。',
    tokens: allTokens.filter(
      (t) =>
        t.key === 'navy' ||
        t.key === 'logo-blue' ||
        t.key === 'bd-blue' ||
        t.key === 'marketing-orange' ||
        t.key === 'landing-purple-light'
    ),
  },
];

export const ColorPalette: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = async (value: string, type: string) => {
    if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedValue(`${type}:${value}`);
        setTimeout(() => {
          setCopiedValue(null);
        }, 1500);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        setCopiedValue(`failed:${type}:${value}`);
        setTimeout(() => {
          setCopiedValue(null);
        }, 2500);
      }
    } else {
      console.warn('Clipboard API not supported in this environment');
      setCopiedValue(`failed:${type}:${value}`);
      setTimeout(() => {
        setCopiedValue(null);
      }, 2500);
    }
  };

  const isCopied = (value: string, type: string) =>
    copiedValue === `${type}:${value}`;

  const query = searchQuery.toLowerCase();
  const filteredGroups = useMemo(() => {
    return colorGroups
      .map((group) => {
        const filteredTokens = group.tokens.filter(
          (token) =>
            token.name.toLowerCase().includes(query) ||
            token.key.toLowerCase().includes(query) ||
            token.hex.toLowerCase().includes(query) ||
            token.variable.toLowerCase().includes(query)
        );
        return { ...group, tokens: filteredTokens };
      })
      .filter((group) => group.tokens.length > 0);
  }, [query]);

  return (
    <div className="font-sans text-text-primary">
      {/* Search & Tool Bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜尋顏色、變數、HEX、或 Tailwind 類別..."
            className="w-full rounded-lg border border-background-border bg-background-bottom-secondary py-2.5 pl-11 pr-4 text-sm text-text-primary outline-none transition-colors focus:bg-background-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-brand-500 text-text-white'
                : 'bg-background-bottom text-text-secondary hover:bg-background-bottom-secondary'
            }`}
          >
            <Grid className="size-4" /> 格狀檢視
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-brand-500 text-text-white'
                : 'bg-background-bottom text-text-secondary hover:bg-background-bottom-secondary'
            }`}
          >
            <List className="size-4" /> 列表檢視
          </button>
        </div>
      </div>

      {/* Main Color Sections */}
      {filteredGroups.length === 0 ? (
        <div className="py-12 text-center text-text-tertiary">
          沒有找到符合 &quot;{searchQuery}&quot; 的設計 Token。
        </div>
      ) : (
        <div className="space-y-10">
          {filteredGroups.map((group) => (
            <section
              key={group.title}
              className="rounded-xl border border-background-border bg-background-white p-6 shadow-sm"
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  {group.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {group.description}
                </p>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {group.tokens.map((token) => (
                    <div
                      key={token.key}
                      className="group flex flex-col overflow-hidden rounded-lg border border-background-border bg-background-white transition-all hover:shadow-md"
                    >
                      {/* Interactive Preview Color Block */}
                      <div
                        className="relative h-28 w-full cursor-pointer border-b border-background-border"
                        style={{ backgroundColor: `hsl(${token.hsl})` }}
                        onClick={() => handleCopy(token.hex, 'hex')}
                        title="點擊複製 HEX 值"
                      >
                        <div className="absolute inset-0 flex items-center justify-center bg-dark/10 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex items-center gap-1 rounded bg-dark/75 px-2 py-1 text-xs font-medium text-text-white">
                            {isCopied(token.hex, 'hex') ? (
                              <>
                                <CheckCircle2 className="size-3 text-brand-500" />
                                已複製 HEX
                              </>
                            ) : copiedValue === `failed:hex:${token.hex}` ? (
                              <>
                                <AlertCircle className="size-3 text-status-error-default" />
                                複製失敗
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                點擊複製 HEX
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Code and Meta Details */}
                      <div className="flex flex-1 flex-col justify-between space-y-2.5 p-3.5">
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">
                            {token.name}
                          </h4>
                          <span className="font-mono text-xs text-text-tertiary">
                            {token.key}
                          </span>
                        </div>

                        <div className="space-y-1 border-t border-background-border pt-1 font-mono text-xs">
                          {/* Copy HEX */}
                          <div className="group/line flex items-center justify-between">
                            <span className="text-text-tertiary">HEX:</span>
                            <button
                              onClick={() => handleCopy(token.hex, 'hex')}
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>{token.hex}</span>
                              {isCopied(token.hex, 'hex') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : copiedValue === `failed:hex:${token.hex}` ? (
                                <AlertCircle className="size-3 text-status-error-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/line:opacity-100" />
                              )}
                            </button>
                          </div>

                          {/* Copy CSS Var */}
                          <div className="group/line flex items-center justify-between">
                            <span className="text-text-tertiary">CSS Var:</span>
                            <button
                              onClick={() =>
                                handleCopy(`var(${token.variable})`, 'var')
                              }
                              className="flex max-w-[120px] items-center gap-1 truncate text-text-primary transition-colors hover:text-brand-500"
                              title={`var(${token.variable})`}
                            >
                              <span className="truncate">{token.variable}</span>
                              {isCopied(`var(${token.variable})`, 'var') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : copiedValue ===
                                `failed:var:var(${token.variable})` ? (
                                <AlertCircle className="size-3 text-status-error-default" />
                              ) : (
                                <Copy className="size-3 flex-shrink-0 opacity-0 transition-opacity group-hover/line:opacity-100" />
                              )}
                            </button>
                          </div>

                          {/* Copy Tailwind utility */}
                          <div className="group/line flex items-center justify-between">
                            <span className="text-text-tertiary">
                              Tailwind:
                            </span>
                            <button
                              onClick={() => handleCopy(token.tailwindBg, 'tw')}
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                              title={`Background Class: ${token.tailwindBg}\nText Class: ${token.tailwindText}`}
                            >
                              <span>{token.tailwindBg}</span>
                              {isCopied(token.tailwindBg, 'tw') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : copiedValue ===
                                `failed:tw:${token.tailwindBg}` ? (
                                <AlertCircle className="size-3 text-status-error-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/line:opacity-100" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View Details */
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-background-border text-xs font-semibold uppercase text-text-tertiary">
                        <th className="w-12 px-4 py-3">預覽</th>
                        <th className="px-4 py-3">名稱 & KEY</th>
                        <th className="px-4 py-3">HEX</th>
                        <th className="px-4 py-3">CSS 變數</th>
                        <th className="px-4 py-3">Tailwind (背景)</th>
                        <th className="px-4 py-3">Tailwind (文字)</th>
                        <th className="px-4 py-3 text-right">HSL 原生值</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {group.tokens.map((token) => (
                        <tr
                          key={token.key}
                          className="group/row border-b border-background-bottom hover:bg-background-bottom-secondary"
                        >
                          <td className="px-4 py-3.5">
                            <div
                              className="size-8 rounded-md border border-background-border shadow-inner"
                              style={{ backgroundColor: `hsl(${token.hsl})` }}
                            />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-text-primary">
                            <div className="font-bold">{token.name}</div>
                            <div className="font-mono text-xs text-text-tertiary">
                              {token.key}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <button
                              onClick={() => handleCopy(token.hex, 'hex')}
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>{token.hex}</span>
                              {isCopied(token.hex, 'hex') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/row:opacity-100" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <button
                              onClick={() =>
                                handleCopy(`var(${token.variable})`, 'var')
                              }
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>var({token.variable})</span>
                              {isCopied(`var(${token.variable})`, 'var') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/row:opacity-100" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <button
                              onClick={() =>
                                handleCopy(token.tailwindBg, 'twbg')
                              }
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>{token.tailwindBg}</span>
                              {isCopied(token.tailwindBg, 'twbg') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/row:opacity-100" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <button
                              onClick={() =>
                                handleCopy(token.tailwindText, 'twtext')
                              }
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>{token.tailwindText}</span>
                              {isCopied(token.tailwindText, 'twtext') ? (
                                <Check className="size-3 text-status-success-default" />
                              ) : (
                                <Copy className="size-3 opacity-0 transition-opacity group-hover/row:opacity-100" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs text-text-tertiary">
                            {token.hsl}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
