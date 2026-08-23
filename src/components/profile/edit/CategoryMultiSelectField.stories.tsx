import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { CategoryMultiSelectField } from './CategoryMultiSelectField';
import { ProfileStoryWrapper } from './ProfileStoryWrapper';

const meta: Meta<typeof CategoryMultiSelectField> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/CategoryMultiSelectField',
  component: CategoryMultiSelectField,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CategoryMultiSelectField>;

const CATEGORIES = [
  {
    key: 'position',
    label: '專業角色 (Positions)',
    options: [
      { value: 'frontend', label: '前端工程師 (Frontend)' },
      { value: 'backend', label: '後端工程師 (Backend)' },
      { value: 'pm', label: '產品經理 (Product Manager)' },
      { value: 'designer', label: 'UI/UX 設計師 (Designer)' },
    ],
  },
  {
    key: 'skill',
    label: '專業技能 (Skills)',
    options: [
      { value: 'react', label: 'React' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'node', label: 'Node.js' },
      { value: 'tailwind', label: 'Tailwind CSS' },
    ],
  },
  {
    key: 'topic',
    label: '諮詢主題 (Topics)',
    options: [
      { value: 'career', label: '職涯規劃 (Career Planning)' },
      { value: 'resume', label: '履歷健檢 (Resume Review)' },
      { value: 'mock-interview', label: '模擬面試 (Mock Interview)' },
    ],
  },
];

export const TreeStructure: Story = {
  name: '分組樹狀結構 (預設)',
  render: () => (
    <ProfileStoryWrapper defaultValues={{ selected_skills: [] }}>
      {(form) => (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">
            展示完整的類別樹狀結構，使用者可以展開/收合各個大類，並選取其中的子項目。
          </p>
          <CategoryMultiSelectField
            form={form}
            name="selected_skills"
            categories={CATEGORIES}
            searchPlaceholder="搜尋技能、主題或角色..."
          />
        </div>
      )}
    </ProfileStoryWrapper>
  ),
};

export const FlatList: Story = {
  name: '扁平化標籤列表 (Flat Mode)',
  render: () => (
    <ProfileStoryWrapper defaultValues={{ selected_skills: [] }}>
      {(form) => (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">
            當 <code>flat=true</code>{' '}
            時，所有的子選項會被拉平直接顯示為標籤列表，適用於選項總量較少或不需分組的場景。
          </p>
          <CategoryMultiSelectField
            form={form}
            name="selected_skills"
            categories={CATEGORIES}
            flat={true}
            searchPlaceholder="在扁平列表中搜尋..."
          />
        </div>
      )}
    </ProfileStoryWrapper>
  ),
};

export const LimitSelection: Story = {
  name: '設定選取數量限制 (Limit: 2)',
  render: () => (
    <ProfileStoryWrapper defaultValues={{ selected_skills: ['frontend'] }}>
      {(form) => (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">
            當設定 <code>maxSelected=2</code> 時，若使用者企圖選取第 3
            個選項，系統將限制其選取，並在畫面上顯示限制提示。
          </p>
          <CategoryMultiSelectField
            form={form}
            name="selected_skills"
            categories={CATEGORIES}
            maxSelected={2}
            searchPlaceholder="搜尋 (最多選取兩個)..."
          />
        </div>
      )}
    </ProfileStoryWrapper>
  ),
};

export const SearchAndFilterShowcase: Story = {
  name: '搜尋與過濾功能展示',
  render: () => (
    <ProfileStoryWrapper
      defaultValues={{ selected_skills: ['react', 'typescript'] }}
    >
      {(form) => (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">
            使用者可以點擊輸入框進行即時輸入搜尋。系統會自動篩選符合輸入字串的選項，並高亮或保留符合條件的群組結構。
          </p>
          <CategoryMultiSelectField
            form={form}
            name="selected_skills"
            categories={CATEGORIES}
            searchPlaceholder="輸入 'react' 或 'career' 測試即時過濾..."
          />
        </div>
      )}
    </ProfileStoryWrapper>
  ),
};
