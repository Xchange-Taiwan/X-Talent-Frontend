import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import AuthOperationLayout from './layout';

const meta: Meta<typeof AuthOperationLayout> = {
  title: '業務模組元件/會員驗證(Auth)/AuthOperationLayout',
  component: AuthOperationLayout,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AuthOperationLayout>;

export const CredentialsSurface: Story = {
  args: {
    children: (
      <div className="bg-background-white flex min-h-screen items-center justify-center p-8">
        <div className="border-background-border w-full max-w-md space-y-4 rounded-xl border p-8">
          <h2 className="text-text-primary text-2xl font-bold">
            登入 X-Talent 帳戶
          </h2>
          <p className="text-text-secondary text-sm">
            路由守衛已統一收斂至 Edge Middleware，Layout
            專注於雙欄視覺殼層呈現。
          </p>
        </div>
      </div>
    ),
  },
};

export const OnboardingSurface: Story = {
  args: {
    children: (
      <div className="bg-background-white flex min-h-screen items-center justify-center p-8">
        <div className="border-background-border w-full max-w-md space-y-4 rounded-xl border p-8">
          <h2 className="text-text-primary text-2xl font-bold">
            完成個人基本資料
          </h2>
          <p className="text-text-secondary text-sm">
            未完成 Onboarding 的已登入會員透過同一雙欄殼層填寫職涯與興趣資料。
          </p>
        </div>
      </div>
    ),
  },
};
