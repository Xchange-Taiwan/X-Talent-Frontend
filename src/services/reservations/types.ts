export type MessageRole = 'MENTEE' | 'MENTOR';

export type ReservationMessage = {
  content: string;
  // Resolved party for this message. Undefined when neither the message's own
  // role nor the sender/participant fallback could classify it.
  role?: MessageRole;
};

export type Reservation = {
  id: string;
  name: string;
  avatar?: string;
  roleLine: string;
  date: string;
  time: string;
  // Full conversation in the order returned by the API. Empty when no messages.
  messages: ReservationMessage[];
  // Latest message authored by each party — derived from `messages` for the
  // card preview. Either side may be undefined when that party hasn't written.
  menteeMessage?: ReservationMessage;
  mentorMessage?: ReservationMessage;

  // Required by the PUT reservation status endpoint
  scheduleId: number;
  dtstart: number;
  dtend: number;

  // Both user ids are kept so we can reliably determine which side the current user is on
  senderUserId: number | string;
  participantUserId: number | string;

  // Set when either side rejected/cancelled. Value is the canceller's role so
  // the UI can render "已由導師/學員取消" on both mentor and mentee pages.
  // Participant (other side) takes precedence when both are REJECT.
  cancelledBy?: 'MENTEE' | 'MENTOR';
};
