'use client';

import Image from 'next/image';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import {
  getPlatformLabelEntry,
  platformLabelMap,
} from '@/components/profile/social-links/platformLabelMap';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContentFrame,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { isSafeUrl } from '@/lib/url/isSafeUrl';
import { cn } from '@/lib/utils';
import type { PersonalLink } from '@/types/types';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type ShareProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  avatarSrc?: string;
  subtitle?: string;
  profilePath: string;
  personalLinks?: PersonalLink[];
};

export function ShareProfileDialog({
  open,
  onOpenChange,
  name,
  avatarSrc,
  subtitle,
  profilePath,
  personalLinks,
}: ShareProfileDialogProps): JSX.Element {
  const [copied, setCopied] = React.useState(false);
  // Seed with the SSR-safe relative path so the server and the first client
  // render agree, then swap in the absolute URL once `window` exists.
  const [profileUrl, setProfileUrl] = React.useState(profilePath);
  const copyTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setProfileUrl(`${window.location.origin}${profilePath}`);
  }, [profilePath]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
      return;
    }
    setCopied(false);
    trackEvent({
      name: 'feature_opened',
      feature: 'profile',
      metadata: { dialog: 'share_profile' },
    });
  }, [open]);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(profileUrl);
    if (!ok) return;

    trackEvent({
      name: 'share_profile_link_copied',
      feature: 'profile',
    });
    setCopied(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-dark/70 z-[100]" />

        <DialogContentFrame className="border-background-border bg-light z-[101] block w-[calc(100%-32px)] max-w-screen-sm gap-0 rounded-[24px] px-6 pt-6 pb-8 shadow-2xl focus:outline-none sm:rounded-[24px] sm:px-8">
          <DialogDescription className="sr-only">
            複製個人頁面連結以分享給他人
          </DialogDescription>

          <div className="relative mb-8 flex items-center justify-center">
            <DialogTitle className="text-36 text-text-primary px-8 text-center leading-none font-semibold tracking-normal">
              分享個人頁面
            </DialogTitle>

            <DialogClose asChild>
              <button
                type="button"
                className={cn(
                  'text-28 text-text-primary absolute top-1/2 right-0 -translate-y-1/2 rounded-sm leading-none',
                  FOCUS_RING_CLASSES
                )}
                aria-label="Close share profile dialog"
              >
                ×
              </button>
            </DialogClose>
          </div>

          <div className="border-background-border bg-light mb-5 rounded-[20px] border px-6 py-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-background-bottom relative size-16 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={avatarSrc || DefaultAvatarImgUrl}
                  alt={`Avatar of ${name}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-18 text-text-primary truncate font-semibold">
                    {name}
                  </p>

                  {personalLinks
                    ?.filter((link) => isSafeUrl(link.url))
                    .map((link) => {
                      const entry =
                        getPlatformLabelEntry(link.platform) ??
                        platformLabelMap[link.platform];
                      return (
                        <a
                          key={link.platform}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`前往 ${entry?.label ?? link.platform} 頁面`}
                          className={cn(
                            'shrink-0 rounded-sm',
                            FOCUS_RING_CLASSES
                          )}
                        >
                          {entry?.icon}
                        </a>
                      );
                    })}
                </div>

                {subtitle ? (
                  <p className="text-14 text-text-primary mt-1 font-medium">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="share-profile-link"
              className="text-14 text-text-primary mb-2 block font-medium"
            >
              個人頁面連結
            </label>

            <div className="border-background-border bg-light flex items-center gap-3 rounded-[14px] border px-4 py-3">
              <input
                id="share-profile-link"
                value={profileUrl}
                readOnly
                className={cn(
                  'text-text-primary md:text-14 w-full min-w-0 flex-1 rounded-sm border-0 bg-transparent text-base outline-none',
                  FOCUS_RING_CLASSES
                )}
              />

              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="border-background-border bg-light text-14 text-text-primary hover:bg-background-bottom-secondary h-10 shrink-0 rounded-[10px] border px-4 font-medium"
              >
                {copied ? '已複製' : '複製'}
              </Button>
            </div>
          </div>
        </DialogContentFrame>
      </DialogPortal>
    </Dialog>
  );
}
