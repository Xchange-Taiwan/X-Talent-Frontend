import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { RequiredIndicator } from './RequiredIndicator';
import { Section } from './Section';

const meta: Meta<typeof Section> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/Section',
  component: Section,
  tags: ['autodocs'],
  args: {
    title: '個人基本資料',
    required: false,
  },
};

export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: (args) => (
    <Section {...args}>
      <div className="space-y-4 rounded-lg border border-background-border p-4">
        <p className="text-sm text-text-secondary">
          這是 Section 元件的內容區域。你可以在這裡放置各種表單欄位或區塊元件。
        </p>
      </div>
    </Section>
  ),
};

export const Required: Story = {
  args: {
    title: '必填區塊 (例如：姓名、信箱)',
    required: true,
  },
  render: (args) => (
    <Section {...args}>
      <div className="space-y-4 rounded-lg border border-background-border p-4">
        <p className="text-sm text-text-secondary">
          當 <code>required=true</code> 時，標題左側會自動顯示由{' '}
          <code>RequiredIndicator</code> 渲染的紅色星號 <code>*</code>。
        </p>
      </div>
    </Section>
  ),
};

export const RequiredIndicatorDemo: Story = {
  name: 'RequiredIndicator 獨立展示',
  render: () => (
    <div className="space-y-6 rounded-lg border border-background-border bg-background-white p-6">
      <h3 className="border-b pb-2 text-lg font-bold">
        RequiredIndicator 元件功能示範
      </h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="w-48 text-sm font-semibold">
            顯示必填指示器 (show=true):
          </span>
          <span className="text-lg">
            <RequiredIndicator show={true} />
            必填欄位
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-48 text-sm font-semibold">
            隱藏必填指示器 (show=false):
          </span>
          <span className="text-lg">
            <RequiredIndicator show={false} />
            非必填欄位
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-48 text-sm font-semibold">
            預設狀態 (不帶參數):
          </span>
          <span className="text-lg">
            <RequiredIndicator />
            預設必填
          </span>
        </div>
      </div>
    </div>
  ),
};
