import { apiClient } from '@/lib/apiClient';

export interface AnnouncementData {
  enabled: boolean;
  message: string;
  maintenanceTime: string;
}

export async function fetchAnnouncement(
  signal?: AbortSignal
): Promise<AnnouncementData | null> {
  const res = await apiClient.get<AnnouncementData>('/api/announcement', {
    auth: false,
    isLocal: true,
    signal,
  });
  return res || null;
}

export function isMaintenanceExpired(
  data: AnnouncementData | null | undefined,
  now: number = Date.now()
): boolean {
  if (!data || !data.maintenanceTime) {
    return false;
  }
  const maintenanceDate = new Date(data.maintenanceTime);
  if (isNaN(maintenanceDate.getTime())) {
    return false;
  }
  return maintenanceDate.getTime() - now <= 0;
}

export function getMaintenanceTimeRemaining(
  data: AnnouncementData | null | undefined,
  now: number = Date.now()
): number {
  if (!data || !data.maintenanceTime) {
    return 0;
  }
  const maintenanceDate = new Date(data.maintenanceTime);
  if (isNaN(maintenanceDate.getTime())) {
    return 0;
  }
  return maintenanceDate.getTime() - now;
}
