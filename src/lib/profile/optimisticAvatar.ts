let lastOptimisticAvatar: {
  avatar: string;
  userId: number;
  timestamp: number;
} | null = null;

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
