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
  trackEvent,
} from '@/lib/analytics';

import AnalyticsUserSync from './AnalyticsUserSync';

const DEMO_GA_ID = 'G-STORYBOOK866';

function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    '0' in val &&
    'length' in val &&
    typeof val.length === 'number'
  );
}

function serializeDataLayerEntry(entry: unknown): string {
  if (Array.isArray(entry)) {
    return JSON.stringify(entry);
  }
  if (isArrayLikeEntry(entry)) {
    return JSON.stringify(Array.from(entry));
  }
  return JSON.stringify(entry);
}

function UserIdentitySyncDemo({ scenarioLabel }: { scenarioLabel: string }) {
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

  const handleSimulateEmailLogin = () => {
    trackEvent({
      name: 'login',
      feature: 'auth',
      metadata: {
        method: 'Email',
        user_role: activeContext.userRole ?? 'mentee',
      },
    });
    syncEntries();
  };

  const handleSimulateLogout = () => {
    clearAnalyticsUser({ gaId: DEMO_GA_ID });
    syncEntries();
  };

  return (
    <div className="bg-background-white border-background-border space-y-4 rounded-lg border p-6">
      <AnalyticsUserSync gaId={DEMO_GA_ID} />
      <div className="space-y-1">
        <h3 className="text-text-primary text-base font-semibold">
          GA4 AnalyticsUserSync 身分綁定面板（{scenarioLabel}）
        </h3>
        <p className="text-text-secondary text-sm">
          目前同步狀態：
          <code className="font-mono">
            user_id={String(activeContext.userId)} / user_role=
            {String(activeContext.userRole)}
          </code>
          （僅傳遞內部 User ID，絕不含 Email、姓名與 Token）
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSampleClick}>
          觸發按鈕事件（驗證自動附帶 user_id / user_role）
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSimulateEmailLogin}
        >
          模擬發送 login (method=Email)
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

const meta: Meta<typeof AnalyticsUserSync> = {
  title: '基礎設施元件/Analytics/AnalyticsUserSync',
  component: AnalyticsUserSync,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AnalyticsUserSync>;

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
  render: () => <UserIdentitySyncDemo scenarioLabel="已登入學員 (mentee)" />,
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
  render: () => <UserIdentitySyncDemo scenarioLabel="已登入導師 (mentor)" />,
};

export const UnauthenticatedGuest: Story = {
  parameters: {
    nextAuth: {
      session: null,
      status: 'unauthenticated',
    },
  },
  render: () => <UserIdentitySyncDemo scenarioLabel="未登入訪客 (guest)" />,
};
