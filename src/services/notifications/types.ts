export type NotificationItem = {
  id: string;
  type:
    | 'reservation_requested'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming'
    | 'feedback_received';
  menteeName?: string;
  mentorName?: string;
  reservationId?: string;
  createdAt: string; // ISO string
  unread?: boolean;
  role?: 'mentor' | 'mentee';
  actorRole?: 'mentor' | 'mentee' | 'system';
  dtstart?: number;
  dtend?: number;
};
