'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { platformLabelMap } from '@/components/profile/social-links/platformLabelMap';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { isSafeUrl } from '@/lib/url/isSafeUrl';
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

type ShareProfileDialogProps = {
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

  React.useEffect(() => {
    setProfileUrl(`${window.location.origin}${profilePath}`);
  }, [profilePath]);

  React.useEffect(() => {
    if (open) {
      setCopied(false);
      trackEvent({
        name: 'feature_opened',
        feature: 'profile',
        metadata: { dialog: 'share_profile' },
      });
      document.documentElement.style.setProperty(
        'overflow',
        'hidden',
        'important'
      );
    } else {
      document.documentElement.style.removeProperty('overflow');
    }
    return () => {
      document.documentElement.style.removeProperty('overflow');
    };
  }, [open]);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(profileUrl);
    if (!ok) return;

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-dark/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] w-[calc(100%-32px)] max-w-screen-sm -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-background-border bg-light shadow-2xl focus:outline-none">
          <Dialog.Description className="sr-only">
            複製個人頁面連結以分享給他人
          </Dialog.Description>
          <div className="rounded-[24px] bg-light px-6 pt-6 pb-8 sm:px-8">
            <div className="relative mb-8 flex items-center justify-center">
              <Dialog.Title className="text-center text-36 leading-none font-semibold text-text-primary">
                分享個人頁面
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="absolute top-1/2 right-0 -translate-y-1/2 text-28 leading-none text-text-primary"
                  aria-label="Close share profile dialog"
                >
                  ×
                </button>
              </Dialog.Close>
            </div>

            <div className="mb-5 rounded-[20px] border border-background-border bg-light px-6 py-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-background-bottom">
                  <Image
                    src={avatarSrc || DefaultAvatarImgUrl}
                    alt={`Avatar of ${name}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-18 font-semibold text-text-primary">
                      {name}
                    </p>

                    {personalLinks
                      ?.filter((link) => isSafeUrl(link.url))
                      .map((link) => (
                        <a
                          key={link.platform}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`前往 ${platformLabelMap[link.platform]?.label ?? link.platform} 頁面`}
                          className="shrink-0"
                        >
                          {platformLabelMap[link.platform]?.icon}
                        </a>
                      ))}
                  </div>

                  {subtitle ? (
                    <p className="mt-1 text-14 font-medium text-text-primary">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="share-profile-link"
                className="mb-2 block text-14 font-medium text-text-primary"
              >
                個人頁面連結
              </label>

              <div className="flex items-center gap-3 rounded-[14px] border border-background-border bg-light px-4 py-3">
                <input
                  id="share-profile-link"
                  value={profileUrl}
                  readOnly
                  className="w-full min-w-0 flex-1 rounded-sm border-0 bg-transparent text-base text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-14"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-10 shrink-0 rounded-[10px] border border-background-border bg-light px-4 text-14 font-medium text-text-primary hover:bg-background-bottom-secondary"
                >
                  {copied ? '已複製' : '複製'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
