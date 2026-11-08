import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts an enum object into an array of { value, label } options for use in dropdowns.
 */
export function enumToOptionsArray(
  enumObj: Record<string, string>
): { value: string; label: string }[] {
  return Object.keys(enumObj).map((key) => ({
    value: key,
    label: enumObj[key],
  }));
}
