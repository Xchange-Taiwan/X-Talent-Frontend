export type NotificationItem = {
  id: string;
  type:
    | 'reservation_requested'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming'
    | 'reservation_feedback_received';
  menteeName?: string;
  mentorName?: string;
  reservationId?: string;
  sessionLink?: string;
  createdAt: string; // ISO string
  unread?: boolean;
  role?: 'mentor' | 'mentee';
  actorRole?: 'mentor' | 'mentee' | 'system';
  dtstart?: number;
  dtend?: number;
};
