import type { Meta, StoryObj } from '@storybook/nextjs';

import ErrorBoundary, { DefaultErrorFallback } from './ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'System/ErrorBoundary',
  component: ErrorBoundary,
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
