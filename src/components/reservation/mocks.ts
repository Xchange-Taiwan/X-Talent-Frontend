import type { Reservation } from '@/types/reservation';

// Standard mock base for a reservation, shared across all reservation-related stories
export const mockReservation: Reservation = {
  id: 'res-415',
  name: '王小明 (Alvin Wang)',
  roleLine: 'Google 台灣 Senior Frontend Engineer / 前端架構專家',
  date: '2026年8月5日 (星期三)',
  time: '20:00 – 21:00',
  messages: [
    {
      content:
        '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
      role: 'MENTEE',
    },
  ],
  menteeMessage: {
    content:
      '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
    role: 'MENTEE',
  },
  scheduleId: 101,
  dtstart: Math.floor(Date.now() / 1000) + 3 * 24 * 3600, // 3 days in future
  dtend: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 + 3600,
  senderUserId: 'user-mentee-111',
  participantUserId: 'user-mentor-222',
};
