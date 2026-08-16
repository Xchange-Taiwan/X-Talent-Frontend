export interface SessionUser {
  id?: string;
  name?: string | null;
  onBoarding?: boolean;
}

export function hasUserProperties(user: unknown): user is SessionUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    ('id' in user || 'onBoarding' in user)
  );
}

// Shared by the Server Actions in src/actions/auth.ts and
// src/app/profile/[pageUserId]/actions.ts. Both are callable directly
// (Server Actions are just POST endpoints under the hood) with any
// payload, bypassing whatever UI normally supplies `userId`. `unknown`
// (not `string`) because that payload isn't guaranteed to even be a
// string at runtime; a `userId: string` parameter elsewhere is a
// compile-time contract for typed callers, not a runtime guarantee for a
// hand-crafted request.
export function isValidUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && /^\d+$/.test(userId);
}
