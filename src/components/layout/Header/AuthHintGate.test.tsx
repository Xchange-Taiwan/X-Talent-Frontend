import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { AuthHintGate, AuthHintProvider } from './AuthHintGate';

describe('AuthHintGate', () => {
  it('applies hidden + group-data-[auth-state=...] display classes from AuthHintProvider when state is unknown', () => {
    const { container } = render(
      <AuthHintProvider identity={UNKNOWN_IDENTITY}>
        <AuthHintGate
          when={['guest']}
          display="flex"
          className="items-center gap-3"
        >
          <span>訪客內容</span>
        </AuthHintGate>
      </AuthHintProvider>
    );

    expect(container.firstElementChild).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:flex',
      'items-center',
      'gap-3'
    );
    expect(screen.getByText('訪客內容')).toBeInTheDocument();
  });

  it('merges pre-hydration classes directly onto child element when asChild is true', () => {
    render(
      <AuthHintProvider identity={UNKNOWN_IDENTITY}>
        <AuthHintGate asChild when={['mentee', 'mentor']}>
          <div data-testid="avatar-placeholder" className="size-8" />
        </AuthHintGate>
      </AuthHintProvider>
    );

    expect(screen.getByTestId('avatar-placeholder')).toHaveClass(
      'size-8',
      'hidden',
      'group-data-[auth-state=mentee]/auth-state:block',
      'group-data-[auth-state=mentor]/auth-state:block'
    );
  });

  it('hides excluded roles via group-data-[auth-state=...]:hidden when defaultVisible is true', () => {
    const { container } = render(
      <AuthHintProvider identity={UNKNOWN_IDENTITY}>
        <AuthHintGate when={['guest']} defaultVisible>
          <span>行動導覽</span>
        </AuthHintGate>
      </AuthHintProvider>
    );

    expect(container.firstElementChild).toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:hidden',
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );
    expect(container.firstElementChild).not.toHaveClass('hidden');
  });

  it('renders unhinted fallback only while unknown and unmounts once resolved', () => {
    const { container, rerender } = render(
      <AuthHintProvider identity={UNKNOWN_IDENTITY}>
        <AuthHintGate when="unhinted">
          <span>載入骨架</span>
        </AuthHintGate>
      </AuthHintProvider>
    );

    expect(container.firstElementChild).toHaveClass(
      'group-data-[auth-state=guest]/auth-state:hidden',
      'group-data-[auth-state=mentee]/auth-state:hidden',
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );

    rerender(
      <AuthHintProvider identity={GUEST_IDENTITY}>
        <AuthHintGate when="unhinted">
          <span>載入骨架</span>
        </AuthHintGate>
      </AuthHintProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children directly without wrapper when resolved role matches and returns null on mismatch or onlyWhileUnknown', () => {
    const { container, rerender } = render(
      <AuthHintProvider
        identity={authenticatedIdentity('mentor-1', { isMentor: true })}
      >
        <AuthHintGate when={['mentor']}>
          <span>導師專屬</span>
        </AuthHintGate>
      </AuthHintProvider>
    );
    expect(screen.getByText('導師專屬')).toBeInTheDocument();
    expect(container.firstElementChild?.tagName).toBe('SPAN');

    rerender(
      <AuthHintProvider
        identity={buildResolvedIdentity({
          state: 'hint-only',
          isMentor: false,
        })}
      >
        <AuthHintGate when={['mentor']}>
          <span>導師專屬</span>
        </AuthHintGate>
      </AuthHintProvider>
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <AuthHintProvider
        identity={authenticatedIdentity('mentor-1', { isMentor: true })}
      >
        <AuthHintGate when={['mentor']} onlyWhileUnknown>
          <span>預渲染專用</span>
        </AuthHintGate>
      </AuthHintProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
