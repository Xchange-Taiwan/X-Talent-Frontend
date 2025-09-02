export type Reservation = {
  id: string;
  name: string;
  avatar?: string;
  roleLine: string;
  date: string;
  time: string;
  note?: string;

  // PUT 需要
  scheduleId: number;
  dtstart: number;
  dtend: number;

  // ✅ 同時保留兩邊 id，避免判錯
  senderUserId: number | string;
  participantUserId: number | string;
};
