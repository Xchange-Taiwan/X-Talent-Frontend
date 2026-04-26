import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Category, CategoryMultiSelect } from './category-multi-select';

const skillCategories: Category[] = [
  {
    key: 'business',
    label: '商業',
    options: [
      { value: 'biz_strategy', label: '商業策略' },
      { value: 'product_management', label: '產品管理' },
      { value: 'user_research', label: '用戶研究' },
    ],
  },
  {
    key: 'tech',
    label: '技術',
    options: [
      { value: 'frontend', label: '前端開發' },
      { value: 'backend', label: '後端開發' },
      { value: 'mobile', label: '行動應用開發' },
      { value: 'data', label: '資料科學' },
    ],
  },
  {
    key: 'marketing',
    label: '行銷',
    options: [
      { value: 'digital_marketing', label: '數位行銷' },
      { value: 'growth_hacking', label: '增長駭客' },
      { value: 'social_content', label: '社交內容創作' },
      { value: 'seo', label: 'SEO' },
    ],
  },
];

const positionCategories: Category[] = [
  {
    key: 'engineering',
    label: '工程',
    options: [
      { value: 'fe_engineer', label: '前端工程師' },
      { value: 'be_engineer', label: '後端工程師' },
      { value: 'fullstack', label: '全端工程師' },
      { value: 'mobile_engineer', label: '行動工程師' },
    ],
  },
  {
    key: 'design',
    label: '設計',
    options: [
      { value: 'ui_ux', label: 'UI / UX 設計師' },
      { value: 'graphic', label: '平面設計' },
      { value: 'product_designer', label: '產品設計師' },
    ],
  },
  {
    key: 'product',
    label: '產品',
    options: [
      { value: 'pm', label: '產品經理' },
      { value: 'po', label: 'Product Owner' },
    ],
  },
  {
    key: 'data',
    label: '數據',
    options: [
      { value: 'ds', label: '數據科學家' },
      { value: 'data_analyst', label: '資料分析師' },
      { value: 'ml_eng', label: '機器學習工程師' },
    ],
  },
];

const meta: Meta<typeof CategoryMultiSelect> = {
  title: 'UI/CategoryMultiSelect',
  component: CategoryMultiSelect,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light' },
    docs: {
      description: {
        component:
          '兩層 list + 搜尋 + 數量上限的多選元件。設計來源：X-Talent-Tracker issue #108。第一層為分類，可展開 / 收合，並顯示「已選 / 全部」；第二層為 checkbox 選項。達上限後未勾選的選項會被 disable。',
      },
    },
  },
  argTypes: {
    onChange: { action: 'change' },
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CategoryMultiSelect>;

const Interactive = (
  args: React.ComponentProps<typeof CategoryMultiSelect>
): React.ReactElement => {
  const [value, setValue] = React.useState<string[]>(args.value);
  return (
    <CategoryMultiSelect
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange?.(next);
      }}
    />
  );
};

export const Default: Story = {
  args: {
    categories: skillCategories,
    value: [],
    maxSelected: 10,
  },
  render: (args) => <Interactive {...args} />,
};

export const PartiallySelected: Story = {
  args: {
    categories: skillCategories,
    value: ['biz_strategy', 'frontend', 'backend'],
    maxSelected: 10,
  },
  render: (args) => <Interactive {...args} />,
};

export const LimitReached: Story = {
  args: {
    categories: skillCategories,
    value: [
      'biz_strategy',
      'product_management',
      'user_research',
      'frontend',
      'backend',
      'mobile',
      'data',
      'digital_marketing',
      'growth_hacking',
      'social_content',
    ],
    maxSelected: 10,
  },
  render: (args) => <Interactive {...args} />,
};

export const PositionMenu: Story = {
  name: '範例：職位選單',
  args: {
    categories: positionCategories,
    value: ['fe_engineer', 'ui_ux'],
    maxSelected: 10,
  },
  render: (args) => <Interactive {...args} />,
};

export const SmallerLimit: Story = {
  name: '上限 3 個',
  args: {
    categories: skillCategories,
    value: ['biz_strategy', 'frontend', 'digital_marketing'],
    maxSelected: 3,
  },
  render: (args) => <Interactive {...args} />,
};

export const Empty: Story = {
  args: {
    categories: [],
    value: [],
    maxSelected: 10,
    emptyText: '目前沒有可選的選項',
  },
  render: (args) => <Interactive {...args} />,
};
