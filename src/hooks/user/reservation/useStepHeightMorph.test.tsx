import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStepHeightMorph } from './useStepHeightMorph';

function StepMorphHarness({
  stepKey,
  onCapture,
}: {
  stepKey: string;
  onCapture?: (fn: () => void) => void;
}) {
  const { containerRef, captureCurrentHeight } = useStepHeightMorph(stepKey);

  React.useEffect(() => {
    onCapture?.(captureCurrentHeight);
  }, [captureCurrentHeight, onCapture]);

  return (
    <div>
      <button
        type="button"
        data-testid="capture-btn"
        onClick={captureCurrentHeight}
      >
        Capture
      </button>
      <div ref={containerRef} data-testid="morph-surface">
        {stepKey}
      </div>
    </div>
  );
}

describe('useStepHeightMorph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('cancels an active Web Animation before measuring natural height on rapid step switches', () => {
    const { rerender } = render(<StepMorphHarness stepKey="q1-attendance" />);
    const surface = screen.getByTestId('morph-surface');

    let naturalHeight = 220;
    let lockedAnimHeight: number | null = null;

    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() =>
      fromPartial<DOMRect>({
        height: lockedAnimHeight ?? naturalHeight,
      })
    );

    const firstCancel = vi.fn(() => {
      lockedAnimHeight = null;
    });
    const secondCancel = vi.fn(() => {
      lockedAnimHeight = null;
    });

    const animateSpy = vi
      .fn()
      .mockImplementationOnce(() => {
        // Simulate mid-flight animation overriding element height at 290px
        lockedAnimHeight = 290;
        return fromPartial<Animation>({
          cancel: firstCancel,
          onfinish: null,
        });
      })
      .mockImplementationOnce(() =>
        fromPartial<Animation>({
          cancel: secondCancel,
          onfinish: null,
        })
      );

    Object.defineProperty(surface, 'animate', {
      writable: true,
      configurable: true,
      value: animateSpy,
    });

    // Step 1 -> Step 2: 220px -> 420px
    fireEvent.click(screen.getByTestId('capture-btn'));
    naturalHeight = 420;
    rerender(<StepMorphHarness stepKey="q1-rating" />);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(animateSpy).toHaveBeenNthCalledWith(
      1,
      [{ height: '220px' }, { height: '420px' }],
      expect.objectContaining({ duration: 340 })
    );

    // Rapidly click Back while first animation is mid-flight at 290px:
    // captureCurrentHeight records 290px, then useLayoutEffect MUST cancel
    // first animation BEFORE measuring naturalHeight (220px) so it morphs 290px -> 220px!
    fireEvent.click(screen.getByTestId('capture-btn'));
    naturalHeight = 220;
    rerender(<StepMorphHarness stepKey="q1-attendance" />);

    expect(firstCancel).toHaveBeenCalledTimes(1);
    expect(animateSpy).toHaveBeenCalledTimes(2);
    expect(animateSpy).toHaveBeenNthCalledWith(
      2,
      [{ height: '290px' }, { height: '220px' }],
      expect.objectContaining({ duration: 340 })
    );
  });

  it('cancels an active Web Animation even when stepKey changes without captureCurrentHeight (queue skip)', () => {
    const { rerender, unmount } = render(
      <StepMorphHarness stepKey="q1-attendance" />
    );
    const surface = screen.getByTestId('morph-surface');

    let currentHeight = 220;
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() =>
      fromPartial<DOMRect>({ height: currentHeight })
    );

    const activeCancel = vi.fn();
    const animateSpy = vi.fn().mockImplementation(() =>
      fromPartial<Animation>({
        cancel: activeCancel,
        onfinish: null,
      })
    );
    Object.defineProperty(surface, 'animate', {
      writable: true,
      configurable: true,
      value: animateSpy,
    });

    // Trigger Step 1 -> Step 2 morph
    fireEvent.click(screen.getByTestId('capture-btn'));
    currentHeight = 420;
    rerender(<StepMorphHarness stepKey="q1-rating" />);
    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(activeCancel).not.toHaveBeenCalled();

    // Queue skips to next reservation ("q2-attendance") without calling captureCurrentHeight (prevHeight === null)
    currentHeight = 220;
    rerender(<StepMorphHarness stepKey="q2-attendance" />);

    expect(activeCancel).toHaveBeenCalledTimes(1);
    expect(animateSpy).toHaveBeenCalledTimes(1);

    unmount();
  });
});
