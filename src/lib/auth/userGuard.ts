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
