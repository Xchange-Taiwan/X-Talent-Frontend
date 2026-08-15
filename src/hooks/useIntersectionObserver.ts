import * as React from 'react';

export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  onIntersect: () => void,
  {
    threshold = 0.1,
    enabled = true,
  }: {
    threshold?: number;
    enabled?: boolean;
  } = {}
) {
  React.useEffect(() => {
    if (!enabled || !onIntersect) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      { threshold }
    );

    const currentElement = ref.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
      observer.disconnect();
    };
  }, [ref, onIntersect, threshold, enabled]);
}
