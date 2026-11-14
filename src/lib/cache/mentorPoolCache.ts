import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';

/**
 * @deprecated Temporary compatibility shim until downstream reservation
 * feedback mutations migrate to `mentorPoolReadModel.clear()` (#888).
 */
export const mentorPoolReadManager = {
  clear: (): void => {
    mentorPoolReadModel.clear();
  },
};
