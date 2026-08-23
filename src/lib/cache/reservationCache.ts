import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import type { Reservation } from '@/types/reservation';

export interface FetchReservationsResult {
  items: Reservation[];
  next_dtend: number;
}

export const reservationCache = createKeyedCache<
  string,
  FetchReservationsResult
>();

export const reservationReadManager = new AsyncReadManager<
  string,
  FetchReservationsResult
>(reservationCache);
