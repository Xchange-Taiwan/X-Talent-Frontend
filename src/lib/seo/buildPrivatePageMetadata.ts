import type { Metadata } from 'next';

/**
 * Builds canonical private-route Metadata (`noindex, nofollow`) for
 * authenticated user pages such as `/favorites` (#908).
 */
export function buildPrivatePageMetadata(title: string): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}
