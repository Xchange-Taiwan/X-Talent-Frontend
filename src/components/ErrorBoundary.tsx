'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { buildBaseEvent, captureError } from '@/lib/monitoring';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  /** Optional fallback UI rendered when a render error is caught (pass explicit null for silent boundaries) */
  fallback?: React.ReactNode;
  /** Component or page name for easier log filtering */
  componentName?: string;
}

interface State {
  hasError: boolean;
}

export interface StatusRecoveryCardProps {
  badge?: React.ReactNode;
  title: string;
  description: string;
  actions: React.ReactNode;
  role?: 'alert' | 'region';
}

export function StatusRecoveryCard({
  badge,
  title,
  description,
  actions,
  role,
}: StatusRecoveryCardProps) {
  return (
    <div
      role={role}
      className="border-background-border bg-background-white mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border px-6 py-10 text-center shadow-sm"
    >
      {badge}
      <h2 className="text-navy mb-2 text-xl font-bold">{title}</h2>
      <p className="text-text-secondary mb-6 text-sm leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actions}
      </div>
    </div>
  );
}

export function DefaultErrorFallback({ onRetry }: { onRetry?: () => void }) {
  const handleReload = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="my-12 w-full px-4">
      <StatusRecoveryCard
        role="alert"
        badge={
          <div className="bg-brand-500/10 mb-4 flex size-14 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-brand-500 size-7"
              aria-hidden="true"
            />
          </div>
        }
        title="畫面載入發生異常"
        description="系統處理此頁面時遇到未預期的問題，請重新整理頁面或返回首頁繼續操作。"
        actions={
          <>
            <button
              type="button"
              onClick={handleReload}
              className={cn(
                'bg-brand-500 text-text-white hover:bg-brand-600 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none',
                FOCUS_RING_CLASSES
              )}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              重新整理頁面
            </button>
            <Link
              href="/"
              className={cn(
                'border-background-border bg-background-white text-text-primary hover:bg-light inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none',
                FOCUS_RING_CLASSES
              )}
            >
              <Home className="size-4" aria-hidden="true" />
              返回首頁
            </Link>
          </>
        }
      />
    </div>
  );
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError({
      ...buildBaseEvent('runtime_error.react_render', error),
      componentStack: info.componentStack ?? undefined,
      componentName: this.props.componentName,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
