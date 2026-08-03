import { apiClient } from '@/lib/apiClient';

export interface AnnouncementData {
  enabled: boolean;
  message: string;
  maintenanceTime: string;
}

export async function fetchAnnouncement(): Promise<AnnouncementData | null> {
  const res = await apiClient.get<AnnouncementData>('/api/announcement', {
    auth: false,
  });
  return res || null;
}
