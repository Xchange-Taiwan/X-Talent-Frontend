'use client';

import * as React from 'react';

import { isReducedMotionPreferred } from './useFeedbackQueueMotion';

const STEP_HEIGHT_MORPH_MS = 340;

export function useStepHeightMorph(stepKey: string) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const prevHeightRef = React.useRef<number | null>(null);
  const animRef = React.useRef<Animation | null>(null);

  const captureCurrentHeight = React.useCallback(() => {
    if (containerRef.current) {
      prevHeightRef.current =
        containerRef.current.getBoundingClientRect().height;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      animRef.current?.cancel();
    };
  }, []);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    const prevHeight = prevHeightRef.current;
    prevHeightRef.current = null;

    if (
      !el ||
      prevHeight === null ||
      typeof el.animate !== 'function' ||
      isReducedMotionPreferred()
    ) {
      return;
    }

    const nextHeight = el.getBoundingClientRect().height;
    if (Math.abs(nextHeight - prevHeight) <= 1) {
      return;
    }

    animRef.current?.cancel();
    const anim = el.animate(
      [{ height: `${prevHeight}px` }, { height: `${nextHeight}px` }],
      {
        duration: STEP_HEIGHT_MORPH_MS,
        easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)',
      }
    );
    animRef.current = anim;
    anim.onfinish = () => {
      if (animRef.current === anim) {
        animRef.current = null;
      }
    };
  }, [stepKey]);

  return {
    containerRef,
    captureCurrentHeight,
  };
}
