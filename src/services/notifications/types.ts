export type NotificationItem = {
  id: string;
  type:
    | 'reservation_requested'
    | 'reservation_success'
    | 'reservation_failed'
    | 'reservation_canceled'
    | 'reservation_upcoming'
    | 'feedback_reminder'
    | 'reservation_feedback_reminder'
    | 'meeting_feedback_reminder'
    | 'feedback_received'
    | 'reservation_feedback_received'
    | 'meeting_feedback_received';
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
