export interface AnnouncementData {
  enabled: boolean;
  message: string;
  maintenanceTime: string;
}

export async function fetchAnnouncement(): Promise<AnnouncementData | null> {
  const res = await fetch('/api/announcement');
  if (!res.ok) {
    throw new Error('Failed to fetch announcement');
  }
  return res.json() as Promise<AnnouncementData>;
}
