'use client';

/**
 * ErrorBoundary
 *
 * React class component error boundary. Captures render-time errors and
 * emits them as runtime_error.react_render monitoring events.
 *
 * Does NOT change the user-facing UI — children are rendered normally.
 * On error, falls back to `fallback` prop (default: null) so the shell
 * stays intact without forcing a full-page crash screen.
 *
 * Usage:
 *   <ErrorBoundary componentName="MentorPool">
 *     <MentorPool />
 *   </ErrorBoundary>
 */

import React from 'react';

import { buildBaseEvent, captureError } from '@/lib/monitoring';

interface Props {
  children: React.ReactNode;
  /** Optional fallback UI rendered when a render error is caught */
  fallback?: React.ReactNode;
  /** Component or page name for easier log filtering */
  componentName?: string;
}

interface State {
  hasError: boolean;
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
