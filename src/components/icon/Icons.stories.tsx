import { IconGallery, IconItem } from '@storybook/blocks';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import * as Icons from './index';

/**
 * ## 圖示元件 (Icons)
 *
 * 本設計系統的圖示元件分為**彩色圖示 (Color Icons)** 與**外框圖示 (Outline Icons)** 兩大類。
 *
 * ### 使用指南
 *
 * 1. **引入方式**：
 *    ```tsx
 *    import { FacebookColor } from '@/components/icon';
 *    ```
 *
 * 2. **自訂大小與樣式**：
 *    元件支援所有標準的 SVG 屬性（如 `className`, `width`, `height`, `style` 等），可輕鬆透過 Tailwind CSS 設定尺寸與外觀：
 *    ```tsx
 *    <FacebookColor className="size-8 hover:opacity-80 transition-opacity" />
 *    ```
 *
 * 3. **無障礙功能 (Accessibility)**：
 *    為了優化螢幕閱讀器體驗，建議在作為純裝飾用途時，不需額外設定屬性（預設 `aria-hidden="true"`）；若圖示具備互動語意，請添加 `aria-label`：
 *    ```tsx
 *    <FacebookColor className="w-6 h-6" aria-label="Facebook 專頁" />
 *    ```
 */
const meta: Meta = {
  title: 'System/Icon Gallery',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
本圖示庫彙整了本設計系統中所有自訂的 SVG 圖示元件。開發者可以直接在此瀏覽、搜尋並複製元件名稱。
        `,
      },
    },
  },
};

export default meta;

export const AllIcons: StoryObj = {
  name: '所有圖示',
  render: () => {
    // 將圖示區分為 Color 與 Outline 兩組
    const allEntries = Object.entries(Icons);
    const colorIcons = allEntries.filter(([name]) => name.endsWith('Color'));
    const outlineIcons = allEntries.filter(([name]) => !name.endsWith('Color'));

    return (
      <div className="flex flex-col gap-10">
        {/* 彩色圖示 */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            彩色圖示 (Color Icons)
          </h3>
          <p className="mb-6 text-sm text-text-tertiary">
            彩色圖示內置了品牌色或特定顏色，適合社群分享或特定品牌按鈕。
          </p>
          <IconGallery>
            {colorIcons.map(([name, IconComponent]) => (
              <IconItem name={name} key={name}>
                <IconComponent className="size-8" />
              </IconItem>
            ))}
          </IconGallery>
        </div>

        {/* 外框圖示 */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            外框圖示 (Outline Icons)
          </h3>
          <p className="mb-6 text-sm text-text-tertiary">
            外框圖示通常為單色，會繼承父層的文字顏色
            (`currentColor`)。未來新增的外框圖示將自動呈現在此。
          </p>
          {outlineIcons.length > 0 ? (
            <IconGallery>
              {outlineIcons.map(([name, IconComponent]) => (
                <IconItem name={name} key={name}>
                  <IconComponent className="size-8" />
                </IconItem>
              ))}
            </IconGallery>
          ) : (
            <div className="rounded-lg border border-dashed border-background-border p-6 text-center text-sm text-text-tertiary">
              目前暫無自訂外框圖示 (Outline Icons)
            </div>
          )}
        </div>
      </div>
    );
  },
};
