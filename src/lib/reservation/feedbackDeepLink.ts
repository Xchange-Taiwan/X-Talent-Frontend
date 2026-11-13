type FeedbackDeepLinkListener = (reservationId: string) => void;

const feedbackDeepLinkListeners = new Set<FeedbackDeepLinkListener>();

export function subscribeFeedbackDeepLink(
  listener: FeedbackDeepLinkListener
): () => void {
  feedbackDeepLinkListeners.add(listener);
  return () => {
    feedbackDeepLinkListeners.delete(listener);
  };
}

export function emitFeedbackDeepLink(
  reservationId: string | number | null | undefined
): void {
  if (reservationId === null || reservationId === undefined) {
    return;
  }
  const trimmed = String(reservationId).trim();
  if (!trimmed) {
    return;
  }
  feedbackDeepLinkListeners.forEach((listener) => {
    listener(trimmed);
  });
}
