import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <Tabs {...args} defaultValue="profile" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="profile">導師基本檔案</TabsTrigger>
        <TabsTrigger value="experience">工作經歷與背景</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-medium">導師公開資料</h3>
          <p className="mb-4 text-sm text-text-tertiary">
            管理您在平台上對學員公開的簡介與主要領域。
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-text-secondary">
                導師姓名
              </span>
              <div className="rounded border bg-background-bottom p-2 text-sm text-text-primary">
                林小明
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-text-secondary">
                目前職位
              </span>
              <div className="rounded border bg-background-bottom p-2 text-sm text-text-primary">
                資深前端工程師 @ Google
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="experience">
        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-medium">工作經歷</h3>
          <p className="mb-4 text-sm text-text-tertiary">
            填寫您的過往職涯履歷，讓學員更了解您的背景與專長。
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-text-secondary">
                核心專長
              </span>
              <div className="rounded border bg-background-bottom p-2 text-sm text-text-primary">
                React, TypeScript, Next.js, Web Performance Optimization
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
