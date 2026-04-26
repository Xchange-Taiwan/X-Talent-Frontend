export type CounterpartyMessage = {
  role: 'MENTEE' | 'MENTOR';
  content: string;
};

export type Reservation = {
  id: string;
  name: string;
  avatar?: string;
  roleLine: string;
  date: string;
  time: string;
  // Latest message from the OTHER party (mentee question, mentor reply / reason).
  counterpartyMessage?: CounterpartyMessage;

  // Required by the PUT reservation status endpoint
  scheduleId: number;
  dtstart: number;
  dtend: number;

  // Both user ids are kept so we can reliably determine which side the current user is on
  senderUserId: number | string;
  participantUserId: number | string;
};
