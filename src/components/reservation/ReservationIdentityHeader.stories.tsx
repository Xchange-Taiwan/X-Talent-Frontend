import type { Meta, StoryObj } from '@storybook/nextjs';

import type { Reservation } from '@/types/reservation';

import { ReservationIdentityHeader } from './ReservationIdentity';

const baseReservation: Reservation = {
  id: 'res-1',
  name: 'Alice User',
  roleLine: '前端工程師, 5-10 年經驗',
  date: '2026-07-26',
  time: '11:00 AM – 11:30 AM',
  dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
  dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
  messages: [],
  scheduleId: 1,
  version: 1,
  senderUserId: 'user-alice',
  participantUserId: 'user-mentor',
};

const meta: Meta<typeof ReservationIdentityHeader> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationIdentityHeader',
  component: ReservationIdentityHeader,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-2xl border p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReservationIdentityHeader>;

// Default styling, as used by ReservationIdentity's dialogs
export const Default: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
    showStatusBadge: true,
  },
};

// variant="card", as used by ReservationCard: top-aligned avatar, a
// wrapped/shrink-0 badge slot, and a children slot for the card's own
// date/time row, message previews, and actions
export const CardStyle: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
    showStatusBadge: true,
    variant: 'card',
    children: (
      <div className="mt-2 text-xs text-text-tertiary sm:text-sm">
        2026-07-26 · 11:00 AM – 11:30 AM
      </div>
    ),
  },
};

// No profile to link to: avatar and name render as plain, non-interactive
// elements
export const NoProfileLink: Story = {
  args: {
    reservation: baseReservation,
  },
};
