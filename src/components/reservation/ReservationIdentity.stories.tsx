import type { Meta, StoryObj } from '@storybook/nextjs';

import type { Reservation } from '@/types/reservation';

import { ReservationIdentity } from './ReservationIdentity';

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

const reservationWithMessage: Reservation = {
  ...baseReservation,
  menteeMessage: {
    content: '您好，想請教一下關於前端職涯發展的建議，謝謝！',
  },
};

const reservationWithBothMessages: Reservation = {
  ...baseReservation,
  menteeMessage: {
    content: '您好，想請教一下關於前端職涯發展的建議，謝謝！',
  },
  mentorMessage: {
    content: '沒問題，到時候見面聊聊您目前的規劃！',
  },
};

const meta: Meta<typeof ReservationIdentity> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationIdentity',
  component: ReservationIdentity,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReservationIdentity>;

// Default: like QuickReplyDialog - default density, no status badge
export const Default: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
  },
};

// Compact density with a status badge, as used by ConfirmedReservationDialog
export const CompactWithStatusBadge: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
    density: 'compact',
    showStatusBadge: true,
  },
};

// With a mentee message block rendered below the card
export const WithMenteeMessage: Story = {
  args: {
    reservation: reservationWithMessage,
    profileHref: '/profile/user-alice',
  },
};

// With both the mentee's message and the mentor's reply, as seen in
// ConfirmedReservationDialog once the mentor has accepted with a reply
export const WithMenteeAndMentorMessages: Story = {
  args: {
    reservation: reservationWithBothMessages,
    profileHref: '/profile/user-alice',
    density: 'compact',
    showStatusBadge: true,
  },
};

// Disabled while a mutation is in flight: the profile link is inert
export const Disabled: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
    disabled: true,
  },
};

// No profile to link to (counterparty id could not be resolved): avatar and
// name render as plain, non-interactive elements
export const NoProfileLink: Story = {
  args: {
    reservation: baseReservation,
    profileHref: undefined,
  },
};

// linkToProfile=false: identical to NoProfileLink even when an href is
// available, for surfaces that never want the identity block to be a link
export const LinkingDisabled: Story = {
  args: {
    reservation: baseReservation,
    profileHref: '/profile/user-alice',
    linkToProfile: false,
  },
};

// showMessages=false, as used by AcceptReservationDialog: the mentee message
// is rendered by the caller instead, under its own label and styling
export const WithoutMessages: Story = {
  args: {
    reservation: reservationWithMessage,
    profileHref: '/profile/user-alice',
    showMessages: false,
  },
};

// The className overrides AcceptReservationDialog needs to stay visually
// unchanged: a smaller, non-responsive avatar and a plainer date/time row
export const AcceptDialogStyle: Story = {
  args: {
    reservation: baseReservation,
    avatarClassName: 'size-10',
    nameClassName: 'truncate font-medium',
    roleLineClassName: 'truncate text-sm text-text-tertiary',
    dateTimeClassName: 'mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2',
    showMessages: false,
  },
};
