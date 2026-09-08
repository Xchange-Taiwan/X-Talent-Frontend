import * as React from 'react';

export interface UseProfileLinkClickOptions {
  /** Makes the profile link inert - e.g. while a mutation (accept / reject /
   * cancel) or another blocking async action (joining a meet) is in flight.
   * Defaults to false. */
  disabled?: boolean;
  /** Called once a plain, unmodified left click on the profile link is
   * confirmed to navigate - e.g. to close the hosting dialog before the
   * route changes. */
  onNavigate?: () => void;
}

/**
 * Click-invalidation for a reservation surface's counterparty profile link:
 * a disabled link swallows the click outright, while a modifier-key click or
 * a non-primary-button click is left untouched so the browser's native
 * "open in a new tab" behavior still applies. A plain left click calls
 * `onNavigate`.
 *
 * Kept separate from `resolveReservationViewer` (`src/lib/reservation/`),
 * which must not depend on React or its event types - see the deep-module
 * boundary noted there.
 */
export function useProfileLinkClick({
  disabled = false,
  onNavigate,
}: UseProfileLinkClickOptions): (e: React.MouseEvent) => void {
  return React.useCallback(
    (e: React.MouseEvent) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        return;
      }
      onNavigate?.();
    },
    [disabled, onNavigate]
  );
}
