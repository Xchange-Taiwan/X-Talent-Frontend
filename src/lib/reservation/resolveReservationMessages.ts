import type { Reservation, ReservationMessage } from '@/types/reservation';

export interface ResolvedReservationMessages {
  messages: ReservationMessage[];
  menteeMessage?: ReservationMessage;
  mentorMessage?: ReservationMessage;
  cancelReasonMessage?: ReservationMessage;
}

/**
 * Splits a chronological list of reservation messages into:
 * - `menteeMessage`: the mentee's booking question / latest non-cancel message
 * - `mentorMessage`: the mentor's reply / latest non-cancel message
 * - `cancelReasonMessage`: the cancellation/rejection reason when cancelled
 * - `messages`: full thread with `isCancelReason: true` set on the cancel reason entry
 */
export function classifyReservationMessages(
  rawMessages: ReservationMessage[],
  cancelledBy?: 'MENTEE' | 'MENTOR' | 'SYSTEM'
): ResolvedReservationMessages {
  const messages = rawMessages.map((msg) => ({ ...msg }));

  let cancelIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].isCancelReason) {
      cancelIdx = i;
      break;
    }
  }

  if (cancelIdx === -1) {
    if (cancelledBy === 'MENTEE') {
      const menteeIndices: number[] = [];
      messages.forEach((msg, idx) => {
        if (msg.role === 'MENTEE') menteeIndices.push(idx);
      });
      if (menteeIndices.length >= 2) {
        cancelIdx = menteeIndices[menteeIndices.length - 1];
      }
    } else if (cancelledBy === 'MENTOR') {
      const mentorIndices: number[] = [];
      messages.forEach((msg, idx) => {
        if (msg.role === 'MENTOR') mentorIndices.push(idx);
      });
      if (mentorIndices.length >= 2) {
        cancelIdx = mentorIndices[mentorIndices.length - 1];
      } else if (
        mentorIndices.length === 1 &&
        mentorIndices[0] === messages.length - 1
      ) {
        cancelIdx = mentorIndices[0];
      }
    }
  }

  if (cancelIdx >= 0 && cancelIdx < messages.length) {
    messages[cancelIdx] = {
      ...messages[cancelIdx],
      isCancelReason: true,
    };
  }

  let menteeMessage: ReservationMessage | undefined;
  let mentorMessage: ReservationMessage | undefined;
  let cancelReasonMessage: ReservationMessage | undefined;

  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    if (item.isCancelReason) {
      cancelReasonMessage = item;
      continue;
    }
    if (item.role === 'MENTEE') {
      menteeMessage = item;
    } else if (item.role === 'MENTOR') {
      mentorMessage = item;
    }
  }

  return {
    messages,
    menteeMessage,
    mentorMessage,
    cancelReasonMessage,
  };
}

/**
 * Resolves message preview fields and conversation thread entries from a
 * `Reservation`, handling both `mapToReservation`-mapped objects and raw test /
 * Storybook fixtures.
 */
export function resolveReservationMessages(
  reservation: Pick<
    Reservation,
    | 'messages'
    | 'menteeMessage'
    | 'mentorMessage'
    | 'cancelReasonMessage'
    | 'cancelledBy'
  >
): ResolvedReservationMessages {
  const classified = classifyReservationMessages(
    reservation.messages ?? [],
    reservation.cancelledBy
  );

  const explicitCancelReason = reservation.cancelReasonMessage
    ? { ...reservation.cancelReasonMessage, isCancelReason: true }
    : undefined;

  const cancelReasonMessage =
    explicitCancelReason ?? classified.cancelReasonMessage;

  let messages = classified.messages;
  if (
    explicitCancelReason &&
    !messages.some((m) => m.isCancelReason) &&
    messages.length > 0
  ) {
    const matchIdx = messages.findLastIndex(
      (m) => m.content === explicitCancelReason.content
    );
    if (matchIdx >= 0) {
      messages = messages.map((m, idx) =>
        idx === matchIdx ? { ...m, isCancelReason: true } : m
      );
    }
  }

  // If `classifyReservationMessages` split out a cancelReasonMessage from
  // `messages`, prefer the classified `menteeMessage` / `mentorMessage` so a
  // naive fixture that left `menteeMessage` pointing at the cancel reason does
  // not duplicate the cancel reason under "學員留言".
  const didSplitFromThread = classified.cancelReasonMessage !== undefined;

  const menteeMessage = didSplitFromThread
    ? classified.menteeMessage
    : reservation.menteeMessage;

  const mentorMessage = didSplitFromThread
    ? classified.mentorMessage
    : reservation.mentorMessage;

  return {
    messages,
    menteeMessage,
    mentorMessage,
    cancelReasonMessage,
  };
}
