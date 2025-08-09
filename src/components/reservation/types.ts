// ---------- Types ----------
export type Reservation = {
  id: string;
  name: string;
  avatar?: string;
  roleLine: string; // e.g., "7 years Experience, Senior UX Designer"
  date: string; // e.g., "Thu, Feb 01, 2024"
  time: string; // e.g., "8:00 pm"
  note?: string;
};
