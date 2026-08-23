import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import type { MentorType } from '@/types/mentor';

export const mentorPoolCache = createKeyedCache<string, MentorType[]>();
export const mentorPoolReadManager = new AsyncReadManager<string, MentorType[]>(
  mentorPoolCache
);
