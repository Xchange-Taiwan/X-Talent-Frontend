import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { announcementReadManager } from '@/hooks/useAnnouncement';
import type { AnnouncementData } from '@/services/announcement';

import { AnnouncementBanner } from './AnnouncementBanner';

const meta: Meta<typeof AnnouncementBanner> = {
  title: '佈局元件/AnnouncementBanner',
  component: AnnouncementBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AnnouncementBanner>;

function renderWithAnnouncement(announcement: AnnouncementData | null) {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('announcement-dismissed');
    } catch {
      // Ignore storage access errors in restricted iframe sandboxes
    }
  }
  announcementReadManager.set('global', announcement);
  return (
    <div className="bg-background-bottom relative min-h-[120px] pt-16">
      <AnnouncementBanner />
    </div>
  );
}

export const ActiveMaintenanceNotice: Story = {
  render: () =>
    renderWithAnnouncement({
      enabled: true,
      message:
        '系統將於 2026/11/15 (日) 02:00–04:00 進行例行維護升級，期間暫停預約服務。',
      maintenanceTime: '2099-12-31T23:59:59.000Z',
    }),
};

export const HiddenWhenDisabled: Story = {
  render: () =>
    renderWithAnnouncement({
      enabled: false,
      message: '',
      maintenanceTime: '',
    }),
};

export const HiddenWhenExpired: Story = {
  render: () =>
    renderWithAnnouncement({
      enabled: true,
      message: '此公告的維護時間已過，將自動隱藏不顯示。',
      maintenanceTime: '2020-01-01T00:00:00.000Z',
    }),
};
