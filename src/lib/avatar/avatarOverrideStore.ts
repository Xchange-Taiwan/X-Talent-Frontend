'use client';

import { useSyncExternalStore } from 'react';

interface AvatarOverride {
  userId: string;
  url: string;
}

let override: AvatarOverride | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setAvatarOverride(userId: string, url: string): void {
  if (override?.userId === userId && override.url === url) return;
  override = { userId, url };
  emit();
}

export function clearAvatarOverride(): void {
  if (override === null) return;
  override = null;
  emit();
}

function getSnapshot(): AvatarOverride | null {
  return override;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAvatarOverride(): AvatarOverride | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
