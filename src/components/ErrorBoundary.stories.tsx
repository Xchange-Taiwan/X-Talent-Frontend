import type { Meta, StoryObj } from '@storybook/nextjs';

import ErrorBoundary, { DefaultErrorFallback } from './ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'System/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    docs: {
      description: {
        component:
          '全域與區塊級 React 錯誤邊界元件：遇到發版交界處舊版資源載入失敗（`ChunkLoadError`）時會透過 `tryRecoverFromChunkLoadError` 單次防迴圈自動重新整理畫面自癒；其餘渲染期例外則上報 Sentry 並呈現正體中文預設恢復卡片 `DefaultErrorFallback`。',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const HealthyChildren: Story = {
  args: {
    children: (
      <div className="text-text-primary p-4 text-sm">正常顯示的頁面內容</div>
    ),
  },
};

export const RecoveryFallbackState: Story = {
  render: () => <DefaultErrorFallback onRetry={() => {}} />,
};
