import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import PageViewTracker from './PageViewTracker';

function AnalyticsInspectorDemo({
  simulatedPathname,
}: {
  simulatedPathname: string;
}) {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    const syncEntries = () => {
      const current = (window.dataLayer ?? []).map((item) =>
        JSON.stringify(item)
      );
      setEntries(current);
    };
    syncEntries();
    const timer = window.setInterval(syncEntries, 250);
    return () => window.clearInterval(timer);
  }, [simulatedPathname]);

  const handleClear = () => {
    window.dataLayer = [];
    setEntries([]);
  };

  return (
    <div className="bg-background-white border-background-border space-y-4 rounded-lg border p-6">
      <PageViewTracker />
      <div className="space-y-1">
        <h3 className="text-text-primary text-base font-semibold">
          GA4 PageViewTracker 互動測試面板
        </h3>
        <p className="text-text-secondary text-sm">
          目前路由：<code className="font-mono">{simulatedPathname}</code>
          （點擊下方按鈕將透過低侵入式{' '}
          <code className="font-mono">data-analytics-click</code> 寫入{' '}
          <code className="font-mono">window.dataLayer</code>）
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          data-analytics-click="storybook_cta_primary"
          data-analytics-location="storybook_demo"
        >
          觸發按鈕埋點
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          data-analytics-click="storybook_cta_disabled"
          data-analytics-location="storybook_demo"
        >
          停用按鈕（不送出事件）
        </Button>
        <Button type="button" variant="secondary" onClick={handleClear}>
          清空紀錄
        </Button>
      </div>
      <div className="bg-background-bottom rounded-md p-3">
        <p className="text-text-secondary mb-2 text-xs font-medium">
          window.dataLayer ({entries.length})
        </p>
        <div className="text-text-primary max-h-40 space-y-1 overflow-auto font-mono text-xs">
          {entries.length > 0 ? (
            entries.map((entry, idx) => (
              <div key={`${idx}-${entry}`}>{entry}</div>
            ))
          ) : (
            <span>尚無事件</span>
          )}
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof PageViewTracker> = {
  title: '基礎設施元件/Analytics/PageViewTracker',
  component: PageViewTracker,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageViewTracker>;

export const InitialHomePageView: Story = {
  render: () => <AnalyticsInspectorDemo simulatedPathname="/" />,
};

export const SpaMentorPoolRoute: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/mentor-pool',
      },
    },
  },
  render: () => <AnalyticsInspectorDemo simulatedPathname="/mentor-pool" />,
};
