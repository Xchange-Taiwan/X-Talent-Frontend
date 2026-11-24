import type { Meta, StoryObj } from '@storybook/nextjs';
import React, {
  useCallback,
  useEffect,
  useInsertionEffect,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  clearAnalyticsUser,
  getAnalyticsUserContext,
  initGa4,
  resetAnalyticsUserState,
  trackButtonClick,
} from '@/lib/analytics';

import PageViewTracker from './PageViewTracker';

const DEMO_GA_ID = 'G-STORYBOOK866';

function serializeDataLayerEntry(entry: unknown): string {
  if (
    typeof entry === 'object' &&
    entry !== null &&
    !Array.isArray(entry) &&
    'length' in entry &&
    typeof entry.length === 'number'
  ) {
    return JSON.stringify(Array.from(entry as ArrayLike<unknown>));
  }
  return JSON.stringify(entry);
}

/**
 * Session identity panel: the single PageViewTracker adapter feeds the
 * TelemetrySessionCoordinator, which binds the sanitized internal user id to
 * GA4 / Clarity / Sentry before the first page_view (X-Tracker #979).
 */
function SessionIdentityDemo({ scenarioLabel }: { scenarioLabel: string }) {
  const [entries, setEntries] = useState<string[]>([]);
  const [activeContext, setActiveContext] = useState(() =>
    getAnalyticsUserContext()
  );

  const syncEntries = useCallback(() => {
    const current = (window.dataLayer ?? []).map(serializeDataLayerEntry);
    setEntries((prev) =>
      prev.length === current.length &&
      prev.every((val, idx) => val === current[idx])
        ? prev
        : current
    );
    const nextContext = getAnalyticsUserContext();
    setActiveContext((prev) =>
      prev.userId === nextContext.userId &&
      prev.userRole === nextContext.userRole
        ? prev
        : nextContext
    );
  }, []);

  useInsertionEffect(() => {
    window.dataLayer = [];
    delete window.gtag;
    resetAnalyticsUserState();
    initGa4(DEMO_GA_ID);
  }, [scenarioLabel]);

  useEffect(() => {
    syncEntries();
    const rafId = window.requestAnimationFrame(syncEntries);
    return () => window.cancelAnimationFrame(rafId);
  }, [scenarioLabel, syncEntries]);

  const handleSampleClick = () => {
    trackButtonClick({
      buttonId: 'storybook_user_sync_cta',
      location: 'storybook_demo',
      feature: 'navigation',
    });
    syncEntries();
  };

  const handleSimulateLogout = () => {
    clearAnalyticsUser({ gaId: DEMO_GA_ID });
    syncEntries();
  };

  return (
    <div className="bg-background-white border-background-border space-y-4 rounded-lg border p-6">
      <PageViewTracker gaId={DEMO_GA_ID} />
      <div className="space-y-1">
        <h3 className="text-text-primary text-base font-semibold">
          遙測身分綁定面板（{scenarioLabel}）
        </h3>
        <p className="text-text-secondary text-sm">
          目前同步狀態：
          <code className="font-mono">
            user_id={String(activeContext.userId)} / user_role=
            {String(activeContext.userRole)}
          </code>
          （GA4、Clarity 與 Sentry 僅接收內部 User ID，絕不含 Email、姓名與
          Token）
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSampleClick}>
          觸發按鈕事件（驗證自動附帶 user_id / user_role）
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSimulateLogout}
        >
          模擬登出清除 (user_id=null)
        </Button>
      </div>
      <div className="bg-background-bottom rounded-md p-3">
        <p className="text-text-secondary mb-2 text-xs font-medium">
          window.dataLayer ({entries.length})
        </p>
        <div className="text-text-primary max-h-48 space-y-1 overflow-auto font-mono text-xs">
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
          <code className="font-mono">data-analytics-click</code> 與{' '}
          <code className="font-mono">data-analytics-param-*</code> 寫入{' '}
          <code className="font-mono">window.dataLayer</code>）
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          data-analytics-click="storybook_cta_primary"
          data-analytics-location="storybook_demo"
        >
          觸發導覽按鈕埋點
        </Button>
        <Button
          type="button"
          variant="outline"
          data-analytics-click="mentor_pool_filter_apply"
          data-analytics-event="mentor_pool_filter_apply"
          data-analytics-feature="mentor_pool"
          data-analytics-location="storybook_demo"
          data-analytics-param-filter-type="filter_skills"
          data-analytics-param-filter-value="frontend"
        >
          觸發導師池篩選埋點
        </Button>
        <Button
          type="button"
          variant="outline"
          data-analytics-click="mentor_card"
          data-analytics-event="mentor_card_click"
          data-analytics-feature="mentor_pool"
          data-analytics-location="storybook_demo"
          data-analytics-param-mentor-id="7482008160728084"
        >
          觸發導師卡片點擊埋點
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

export const AuthenticatedMentee: Story = {
  parameters: {
    nextAuth: {
      user: {
        id: '999001',
        email: 'mentee-private@example.com',
        name: '王小美',
        isMentor: false,
      },
      status: 'authenticated',
    },
  },
  render: () => <SessionIdentityDemo scenarioLabel="已登入學員 (mentee)" />,
};

export const AuthenticatedMentor: Story = {
  parameters: {
    nextAuth: {
      user: {
        id: '999002',
        email: 'mentor-private@example.com',
        name: '陳大文',
        isMentor: true,
      },
      status: 'authenticated',
    },
  },
  render: () => <SessionIdentityDemo scenarioLabel="已登入導師 (mentor)" />,
};

export const UnauthenticatedGuest: Story = {
  parameters: {
    nextAuth: {
      session: null,
      status: 'unauthenticated',
    },
  },
  render: () => <SessionIdentityDemo scenarioLabel="未登入訪客 (guest)" />,
};

export const SentinelUserIdFallsBackToGuest: Story = {
  parameters: {
    nextAuth: {
      user: {
        id: 'null',
        email: 'sentinel-private@example.com',
        name: '林小強',
        isMentor: true,
      },
      status: 'authenticated',
    },
  },
  render: () => (
    <SessionIdentityDemo scenarioLabel="異常 user.id='null' 退回訪客 (guest)" />
  ),
};
