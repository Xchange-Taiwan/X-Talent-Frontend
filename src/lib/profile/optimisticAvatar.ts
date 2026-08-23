let lastOptimisticAvatar: {
  avatar: string;
  userId: number;
  timestamp: number;
} | null = null;

const listeners = new Set<() => void>();

/**
 * Subscribes a listener function to optimistic avatar updates.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToOptimisticAvatar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error notifying optimistic avatar listener:', e);
    }
  });
}

/**
 * Registers an optimistic avatar URL update for a specific user.
 * This is used to bridge the short-lived NextAuth v4 session update transition.
 */
export function registerOptimisticAvatar(
  userId: number,
  avatar: string | null | undefined
): void {
  if (!avatar) {
    lastOptimisticAvatar = null;
  } else {
    lastOptimisticAvatar = { avatar, userId, timestamp: Date.now() };
  }
  notifyListeners();
}

/**
 * Retrieves the registered optimistic avatar if within the 30-second transition window.
 */
export function getOptimisticAvatar(userId: number): string | null {
  if (!lastOptimisticAvatar) return null;
  if (lastOptimisticAvatar.userId !== userId) return null;

  // If more than 30 seconds have passed, consider the transition complete
  if (Date.now() - lastOptimisticAvatar.timestamp > 30_000) {
    lastOptimisticAvatar = null;
    return null;
  }

  return lastOptimisticAvatar.avatar;
}
