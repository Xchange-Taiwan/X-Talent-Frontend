import { Check, CheckCircle2, Copy, Grid, List, Search } from 'lucide-react';
import React, { useState } from 'react';

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

const colorGroups: ColorGroup[] = [
  {
    title: 'Brand Colors (品牌色系)',
    description:
      'X-Talent 核心品牌色系，使用在主要按鈕、焦點視覺、進度條、連結與高亮元素。',
    tokens: [
      {
        key: 'brand-50',
        name: 'Brand 50',
        hex: '#EAFAFA',
        hsl: '180 62% 95%',
        variable: '--color-brand-50',
        tailwindBg: 'bg-brand-50',
        tailwindText: 'text-brand-50',
      },
      {
        key: 'brand-100',
        name: 'Brand 100',
        hex: '#D5F5F5',
        hsl: '180 62% 90%',
        variable: '--color-brand-100',
        tailwindBg: 'bg-brand-100',
        tailwindText: 'text-brand-100',
      },
      {
        key: 'brand-200',
        name: 'Brand 200',
        hex: '#ABEAEA',
        hsl: '180 60% 79%',
        variable: '--color-brand-200',
        tailwindBg: 'bg-brand-200',
        tailwindText: 'text-brand-200',
      },
      {
        key: 'brand-300',
        name: 'Brand 300',
        hex: '#80E0E0',
        hsl: '180 61% 69%',
        variable: '--color-brand-300',
        tailwindBg: 'bg-brand-300',
        tailwindText: 'text-brand-300',
      },
      {
        key: 'brand-400',
        name: 'Brand 400',
        hex: '#56D5D5',
        hsl: '180 60% 59%',
        variable: '--color-brand-400',
        tailwindBg: 'bg-brand-400',
        tailwindText: 'text-brand-400',
      },
      {
        key: 'brand-500',
        name: 'Brand 500 (主色)',
        hex: '#2CCBCB',
        hsl: '180 64% 48%',
        variable: '--color-brand-500',
        tailwindBg: 'bg-brand-500',
        tailwindText: 'text-brand-500',
      },
      {
        key: 'brand-600',
        name: 'Brand 600',
        hex: '#23A2A2',
        hsl: '180 64% 39%',
        variable: '--color-brand-600',
        tailwindBg: 'bg-brand-600',
        tailwindText: 'text-brand-600',
      },
      {
        key: 'brand-700',
        name: 'Brand 700',
        hex: '#1A7A7A',
        hsl: '180 65% 29%',
        variable: '--color-brand-700',
        tailwindBg: 'bg-brand-700',
        tailwindText: 'text-brand-700',
      },
      {
        key: 'brand-800',
        name: 'Brand 800',
        hex: '#125151',
        hsl: '180 64% 19%',
        variable: '--color-brand-800',
        tailwindBg: 'bg-brand-800',
        tailwindText: 'text-brand-800',
      },
      {
        key: 'brand-900',
        name: 'Brand 900',
        hex: '#092929',
        hsl: '180 64% 10%',
        variable: '--color-brand-900',
        tailwindBg: 'bg-brand-900',
        tailwindText: 'text-brand-900',
      },
    ],
  },
  {
    title: 'Gray Scale (中性灰階)',
    description: '基礎灰階色，主要用於邊框、次要背景、區隔線與次要卡片背景。',
    tokens: [
      {
        key: 'gray-100',
        name: 'Gray 100',
        hex: '#E9E9E9',
        hsl: '0 0% 91%',
        variable: '--color-gray-100',
        tailwindBg: 'bg-gray-100',
        tailwindText: 'text-gray-100',
      },
      {
        key: 'gray-200',
        name: 'Gray 200',
        hex: '#D2D2D2',
        hsl: '0 0% 82%',
        variable: '--color-gray-200',
        tailwindBg: 'bg-gray-200',
        tailwindText: 'text-gray-200',
      },
      {
        key: 'gray-300',
        name: 'Gray 300',
        hex: '#BCBCBC',
        hsl: '0 0% 74%',
        variable: '--color-gray-300',
        tailwindBg: 'bg-gray-300',
        tailwindText: 'text-gray-300',
      },
      {
        key: 'gray-400',
        name: 'Gray 400',
        hex: '#A5A5A5',
        hsl: '0 0% 65%',
        variable: '--color-gray-400',
        tailwindBg: 'bg-gray-400',
        tailwindText: 'text-gray-400',
      },
      {
        key: 'gray-500',
        name: 'Gray 500',
        hex: '#8F8F8F',
        hsl: '0 0% 56%',
        variable: '--color-gray-500',
        tailwindBg: 'bg-gray-500',
        tailwindText: 'text-gray-500',
      },
      {
        key: 'gray-600',
        name: 'Gray 600',
        hex: '#727272',
        hsl: '0 0% 45%',
        variable: '--color-gray-600',
        tailwindBg: 'bg-gray-600',
        tailwindText: 'text-gray-600',
      },
      {
        key: 'gray-700',
        name: 'Gray 700',
        hex: '#565656',
        hsl: '0 0% 34%',
        variable: '--color-gray-700',
        tailwindBg: 'bg-gray-700',
        tailwindText: 'text-gray-700',
      },
      {
        key: 'gray-800',
        name: 'Gray 800',
        hex: '#393939',
        hsl: '0 0% 22%',
        variable: '--color-gray-800',
        tailwindBg: 'bg-gray-800',
        tailwindText: 'text-gray-800',
      },
      {
        key: 'gray-900',
        name: 'Gray 900',
        hex: '#1D1D1D',
        hsl: '0 0% 11%',
        variable: '--color-gray-900',
        tailwindBg: 'bg-gray-900',
        tailwindText: 'text-gray-900',
      },
    ],
  },
  {
    title: 'Text System (文字系統)',
    description: '嚴格規範頁面內各層級文字的顏色，以確保良好的對比度與易讀性。',
    tokens: [
      {
        key: 'text-primary',
        name: 'Text Primary',
        hex: '#1E2026',
        hsl: '225 12% 13%',
        variable: '--color-text-primary',
        tailwindBg: 'bg-text-primary',
        tailwindText: 'text-text-primary',
      },
      {
        key: 'text-secondary',
        name: 'Text Secondary',
        hex: '#474D57',
        hsl: '218 10% 31%',
        variable: '--color-text-secondary',
        tailwindBg: 'bg-text-secondary',
        tailwindText: 'text-text-secondary',
      },
      {
        key: 'text-tertiary',
        name: 'Text Tertiary',
        hex: '#76808F',
        hsl: '216 10% 51%',
        variable: '--color-text-tertiary',
        tailwindBg: 'bg-text-tertiary',
        tailwindText: 'text-text-tertiary',
      },
      {
        key: 'text-disable',
        name: 'Text Disable',
        hex: '#AEB4BC',
        hsl: '214 9% 71%',
        variable: '--color-text-disable',
        tailwindBg: 'bg-text-disable',
        tailwindText: 'text-text-disable',
      },
      {
        key: 'text-white',
        name: 'Text White',
        hex: '#FFFFFF',
        hsl: '0 0% 100%',
        variable: '--color-text-white',
        tailwindBg: 'bg-text-white',
        tailwindText: 'text-text-white',
      },
    ],
  },
  {
    title: 'Background System (背景與邊框系統)',
    description: '定義頁面背景底色、卡片與元件背景，以及系統基礎邊框線顏色。',
    tokens: [
      {
        key: 'background-bottom',
        name: 'Background Bottom',
        hex: '#F5F5F5',
        hsl: '0 0% 96%',
        variable: '--color-background-bottom',
        tailwindBg: 'bg-background-bottom',
        tailwindText: 'text-background-bottom',
      },
      {
        key: 'background-bottom-secondary',
        name: 'Background Bottom Secondary',
        hex: '#FAFAFA',
        hsl: '0 0% 98%',
        variable: '--color-background-bottom-secondary',
        tailwindBg: 'bg-background-bottom-secondary',
        tailwindText: 'text-background-bottom-secondary',
      },
      {
        key: 'background-white',
        name: 'Background White',
        hex: '#FFFFFF',
        hsl: '0 0% 100%',
        variable: '--color-background-white',
        tailwindBg: 'bg-background-white',
        tailwindText: 'text-background-white',
      },
      {
        key: 'background-border',
        name: 'Background Border',
        hex: '#E6E8EA',
        hsl: '210 9% 91%',
        variable: '--color-background-border',
        tailwindBg: 'bg-background-border',
        tailwindText: 'text-background-border',
      },
    ],
  },
  {
    title: 'Status Colors (狀態色系)',
    description: '用於表示系統反饋（成功、錯誤、警告、資訊）的提示色。',
    tokens: [
      {
        key: 'status-success-default',
        name: 'Success Default',
        hex: '#00BA34',
        hsl: '137 100% 36%',
        variable: '--color-status-success-default',
        tailwindBg: 'bg-status-success-default',
        tailwindText: 'text-status-success-default',
      },
      {
        key: 'status-success-active',
        name: 'Success Active',
        hex: '#2EC659',
        hsl: '137 62% 48%',
        variable: '--color-status-success-active',
        tailwindBg: 'bg-status-success-active',
        tailwindText: 'text-status-success-active',
      },
      {
        key: 'status-error-default',
        name: 'Error Default',
        hex: '#EE3911',
        hsl: '11 87% 50%',
        variable: '--color-status-error-default',
        tailwindBg: 'bg-status-error-default',
        tailwindText: 'text-status-error-default',
      },
      {
        key: 'status-error-active',
        name: 'Error Active',
        hex: '#F15D3C',
        hsl: '11 87% 59%',
        variable: '--color-status-error-active',
        tailwindBg: 'bg-status-error-active',
        tailwindText: 'text-status-error-active',
      },
      {
        key: 'status-warning-default',
        name: 'Warning Default',
        hex: '#EEBE11',
        hsl: '47 87% 50%',
        variable: '--color-status-warning-default',
        tailwindBg: 'bg-status-warning-default',
        tailwindText: 'text-status-warning-default',
      },
      {
        key: 'status-warning-active',
        name: 'Warning Active',
        hex: '#F1CA3C',
        hsl: '47 87% 59%',
        variable: '--color-status-warning-active',
        tailwindBg: 'bg-status-warning-active',
        tailwindText: 'text-status-warning-active',
      },
      {
        key: 'status-info-default',
        name: 'Info Default',
        hex: '#EE7C11',
        hsl: '29 87% 50%',
        variable: '--color-status-info-default',
        tailwindBg: 'bg-status-info-default',
        tailwindText: 'text-status-info-default',
      },
      {
        key: 'status-info-active',
        name: 'Info Active',
        hex: '#F1943C',
        hsl: '29 87% 59%',
        variable: '--color-status-info-active',
        tailwindBg: 'bg-status-info-active',
        tailwindText: 'text-status-info-active',
      },
    ],
  },
  {
    title: 'Interactive & Accent Colors (動態互動與輔助色)',
    description: '主要用於特定導師領域標籤、卡片點綴、或互動反饋元件。',
    tokens: [
      {
        key: 'blue-default',
        name: 'Blue Default',
        hex: '#5DE5FF',
        hsl: '190 100% 68%',
        variable: '--color-blue-default',
        tailwindBg: 'bg-blue-default',
        tailwindText: 'text-blue-default',
      },
      {
        key: 'blue-active',
        name: 'Blue Active',
        hex: '#97EEFF',
        hsl: '190 100% 80%',
        variable: '--color-blue-active',
        tailwindBg: 'bg-blue-active',
        tailwindText: 'text-blue-active',
      },
      {
        key: 'pink-default',
        name: 'Pink Default',
        hex: '#FF6397',
        hsl: '340 100% 69%',
        variable: '--color-pink-default',
        tailwindBg: 'bg-pink-default',
        tailwindText: 'text-pink-default',
      },
      {
        key: 'pink-active',
        name: 'Pink Active',
        hex: '#FF9BBD',
        hsl: '340 100% 80%',
        variable: '--color-pink-active',
        tailwindBg: 'bg-pink-active',
        tailwindText: 'text-pink-active',
      },
      {
        key: 'jade-default',
        name: 'Jade Default',
        hex: '#4BEFBD',
        hsl: '162 84% 62%',
        variable: '--color-jade-default',
        tailwindBg: 'bg-jade-default',
        tailwindText: 'text-jade-default',
      },
      {
        key: 'jade-active',
        name: 'Jade Active',
        hex: '#8CF5D5',
        hsl: '162 84% 75%',
        variable: '--color-jade-active',
        tailwindBg: 'bg-jade-active',
        tailwindText: 'text-jade-active',
      },
      {
        key: 'lime-default',
        name: 'Lime Default',
        hex: '#FFDE4E',
        hsl: '49 100% 65%',
        variable: '--color-lime-default',
        tailwindBg: 'bg-lime-default',
        tailwindText: 'text-lime-default',
      },
      {
        key: 'lime-active',
        name: 'Lime Active',
        hex: '#FFEA8D',
        hsl: '49 100% 78%',
        variable: '--color-lime-active',
        tailwindBg: 'bg-lime-active',
        tailwindText: 'text-lime-active',
      },
      {
        key: 'orange-default',
        name: 'Orange Default',
        hex: '#FFA957',
        hsl: '29 100% 67%',
        variable: '--color-orange-default',
        tailwindBg: 'bg-orange-default',
        tailwindText: 'text-orange-default',
      },
      {
        key: 'orange-active',
        name: 'Orange Active',
        hex: '#FFC894',
        hsl: '29 100% 79%',
        variable: '--color-orange-active',
        tailwindBg: 'bg-orange-active',
        tailwindText: 'text-orange-active',
      },
      {
        key: 'purple-default',
        name: 'Purple Default',
        hex: '#B55AFC',
        hsl: '274 96% 67%',
        variable: '--color-purple-default',
        tailwindBg: 'bg-purple-default',
        tailwindText: 'text-purple-default',
      },
      {
        key: 'purple-active',
        name: 'Purple Active',
        hex: '#D095FD',
        hsl: '274 96% 79%',
        variable: '--color-purple-active',
        tailwindBg: 'bg-purple-active',
        tailwindText: 'text-purple-active',
      },
      {
        key: 'light',
        name: 'Light Base',
        hex: '#FFFFFF',
        hsl: '0 0% 100%',
        variable: '--color-light',
        tailwindBg: 'bg-light',
        tailwindText: 'text-light',
      },
      {
        key: 'dark',
        name: 'Dark Base',
        hex: '#282828',
        hsl: '0 0% 16%',
        variable: '--color-dark',
        tailwindBg: 'bg-dark',
        tailwindText: 'text-dark',
      },
    ],
  },
  {
    title: 'Avatar Elements (頭像與外框設計)',
    description: '專用於個人頭像背景、外框描邊、及頭像上方疊加層遮罩設計。',
    tokens: [
      {
        key: 'avatar-background',
        name: 'Avatar Background',
        hex: '#F4FCFC',
        hsl: '180 57% 97%',
        variable: '--color-avatar-background',
        tailwindBg: 'bg-avatar-background',
        tailwindText: 'text-avatar-background',
      },
      {
        key: 'avatar-border',
        name: 'Avatar Border',
        hex: '#B7CBCB',
        hsl: '180 16% 76%',
        variable: '--color-avatar-border',
        tailwindBg: 'bg-avatar-border',
        tailwindText: 'text-avatar-border',
      },
      {
        key: 'avatar-overlay',
        name: 'Avatar Overlay',
        hex: '#6F6F6F',
        hsl: '0 0% 44%',
        variable: '--color-avatar-overlay',
        tailwindBg: 'bg-avatar-overlay',
        tailwindText: 'text-avatar-overlay',
      },
    ],
  },
  {
    title: 'Legacy & Landing Page Specific (行銷落地方案舊有色系)',
    description:
      '保留給 Landing 頁面與傳統導師分類、BD 部門使用的色值。維持此系列以確保落地位點相容。',
    tokens: [
      {
        key: 'navy',
        name: 'Navy Blue',
        hex: '#172E59',
        hsl: '219 59% 22%',
        variable: '--color-navy',
        tailwindBg: 'bg-navy',
        tailwindText: 'text-navy',
      },
      {
        key: 'logo-blue',
        name: 'Logo Blue',
        hex: '#003C5A',
        hsl: '200 100% 18%',
        variable: '--color-logo-blue',
        tailwindBg: 'bg-logoBlue',
        tailwindText: 'text-logoBlue',
      },
      {
        key: 'bd-blue',
        name: 'BD Blue',
        hex: '#7CB8FF',
        hsl: '212 100% 74%',
        variable: '--color-bd-blue',
        tailwindBg: 'bg-bdBlue',
        tailwindText: 'text-bdBlue',
      },
      {
        key: 'marketing-orange',
        name: 'Marketing Orange',
        hex: '#FFBF82',
        hsl: '29 100% 75%',
        variable: '--color-marketing-orange',
        tailwindBg: 'bg-marketingOrange',
        tailwindText: 'text-marketingOrange',
      },
      {
        key: 'landing-purple-light',
        name: 'Landing Purple Light',
        hex: '#F7F2FB',
        hsl: '270 33% 96%',
        variable: '--color-landing-purple-light',
        tailwindBg: 'bg-landingPurpleLight',
        tailwindText: 'text-landingPurpleLight',
      },
    ],
  },
];

export const ColorPalette: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = (value: string, type: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(`${type}:${value}`);
    setTimeout(() => {
      setCopiedValue(null);
    }, 1500);
  };

  const isCopied = (value: string, type: string) =>
    copiedValue === `${type}:${value}`;

  const filteredGroups = colorGroups
    .map((group) => {
      const filteredTokens = group.tokens.filter(
        (token) =>
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.hex.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.variable.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...group, tokens: filteredTokens };
    })
    .filter((group) => group.tokens.length > 0);

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
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                        >
                          <span
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-white"
                            style={{
                              backgroundColor: 'rgba(40, 40, 40, 0.75)',
                            }}
                          >
                            {isCopied(token.hex, 'hex') ? (
                              <>
                                <CheckCircle2 className="size-3 text-brand-500" />
                                已複製 HEX
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

                        <div
                          className="space-y-1 pt-1 font-mono text-xs"
                          style={{
                            borderTop:
                              '1px solid hsl(var(--color-background-border))',
                          }}
                        >
                          {/* Copy HEX */}
                          <div className="group/line flex items-center justify-between">
                            <span className="text-text-tertiary">HEX:</span>
                            <button
                              onClick={() => handleCopy(token.hex, 'hex')}
                              className="flex items-center gap-1 text-text-primary transition-colors hover:text-brand-500"
                            >
                              <span>{token.hex}</span>
                              {isCopied(token.hex, 'hex') ? (
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                          className="group/row hover:bg-background-bottom-secondary"
                          style={{
                            borderBottom:
                              '1px solid hsl(var(--color-background-bottom))',
                          }}
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
                                <Check
                                  className="size-3"
                                  style={{ color: '#10B981' }}
                                />
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
