export type ReservationMessage = {
  content: string;
};

export type Reservation = {
  id: string;
  name: string;
  avatar?: string;
  roleLine: string;
  date: string;
  time: string;
  // Latest message authored by each party. Either side may be undefined when
  // that party hasn't written anything yet.
  menteeMessage?: ReservationMessage;
  mentorMessage?: ReservationMessage;

  // Required by the PUT reservation status endpoint
  scheduleId: number;
  dtstart: number;
  dtend: number;

  // Both user ids are kept so we can reliably determine which side the current user is on
  senderUserId: number | string;
  participantUserId: number | string;
};
