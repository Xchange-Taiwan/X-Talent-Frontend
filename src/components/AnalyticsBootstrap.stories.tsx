import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  resetAnalyticsUserState,
  setAnalyticsTag,
  trackEvent,
} from '@/lib/analytics';

import AnalyticsBootstrap from './AnalyticsBootstrap';

function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    'length' in val &&
    typeof val.length === 'number'
  );
}

function serializeQueueEntry(item: unknown): string {
  if (Array.isArray(item)) {
    return JSON.stringify(item);
  }
  if (isArrayLikeEntry(item)) {
    return JSON.stringify(Array.from(item));
  }
  return JSON.stringify(item);
}

function AnalyticsBootstrapDemo({
  gaId,
  clarityId,
  scenarioLabel,
}: {
  gaId?: string | null;
  clarityId?: string | null;
  scenarioLabel: string;
}) {
  const [dataLayerEntries, setDataLayerEntries] = useState<string[]>([]);
  const [clarityQueueEntries, setClarityQueueEntries] = useState<string[]>([]);

  const syncSnapshots = useCallback(() => {
    setDataLayerEntries((window.dataLayer ?? []).map(serializeQueueEntry));
    setClarityQueueEntries((window.clarity?.q ?? []).map(serializeQueueEntry));
  }, []);

  useEffect(() => {
    syncSnapshots();
    const timer = window.setInterval(syncSnapshots, 250);
    return () => window.clearInterval(timer);
  }, [syncSnapshots]);

  const handleTrackSignupStarted = () => {
    trackEvent({
      name: 'sign_up_started',
      feature: 'auth',
    });
    syncSnapshots();
  };

  const handleSetClarityTag = () => {
    setAnalyticsTag('onboarding_step', '1');
    syncSnapshots();
  };

  const handleReset = () => {
    resetAnalyticsUserState();
    window.dataLayer = [];
    if (window.clarity) {
      window.clarity.q = [];
    }
    syncSnapshots();
  };

  return (
    <div className="bg-background-white border-background-border space-y-4 rounded-lg border p-6">
      <AnalyticsBootstrap
        gaId={gaId}
        clarityId={clarityId}
        disableExternalScripts
      />
      <div className="space-y-1">
        <h3 className="text-text-primary text-base font-semibold">
          AnalyticsBootstrap 佇列初始化面板（{scenarioLabel}）
        </h3>
        <p className="text-text-secondary text-sm">
          GA4 ID：<code className="font-mono">{gaId ?? '未啟用'}</code> ｜
          Clarity ID：
          <code className="font-mono">{clarityId ?? '未啟用'}</code>
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleTrackSignupStarted}>
          觸發 sign_up_started 事件
        </Button>
        <Button type="button" variant="outline" onClick={handleSetClarityTag}>
          設定 Clarity Session Tag
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset}>
          清空佇列
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-background-bottom rounded-md p-3">
          <p className="text-text-secondary mb-2 text-xs font-medium">
            window.dataLayer ({dataLayerEntries.length})
          </p>
          <div className="text-text-primary max-h-40 space-y-1 overflow-auto font-mono text-xs">
            {dataLayerEntries.length > 0 ? (
              dataLayerEntries.map((entry, idx) => (
                <div key={`dl-${idx}-${entry}`}>{entry}</div>
              ))
            ) : (
              <span>尚無 GA4 指令</span>
            )}
          </div>
        </div>
        <div className="bg-background-bottom rounded-md p-3">
          <p className="text-text-secondary mb-2 text-xs font-medium">
            window.clarity.q ({clarityQueueEntries.length})
          </p>
          <div className="text-text-primary max-h-40 space-y-1 overflow-auto font-mono text-xs">
            {clarityQueueEntries.length > 0 ? (
              clarityQueueEntries.map((entry, idx) => (
                <div key={`cl-${idx}-${entry}`}>{entry}</div>
              ))
            ) : (
              <span>尚無 Clarity 佇列指令</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof AnalyticsBootstrap> = {
  title: '基礎設施元件/Analytics/AnalyticsBootstrap',
  component: AnalyticsBootstrap,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AnalyticsBootstrap>;

export const BothGa4AndClarityEnabled: Story = {
  render: () => (
    <AnalyticsBootstrapDemo
      gaId="G-STORYBOOK902"
      clarityId="claritydemo1"
      scenarioLabel="GA4 + Clarity 同步啟用"
    />
  ),
};

export const ClarityQueuePreScriptOnly: Story = {
  render: () => (
    <AnalyticsBootstrapDemo
      gaId={null}
      clarityId="clarityonly2"
      scenarioLabel="僅啟用 Clarity 預先佇列"
    />
  ),
};

export const DisabledWhenIdsInvalidOrUnset: Story = {
  render: () => (
    <AnalyticsBootstrapDemo
      gaId={null}
      clarityId={null}
      scenarioLabel="未設定追蹤 ID"
    />
  ),
};
