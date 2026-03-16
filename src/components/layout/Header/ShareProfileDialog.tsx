'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import * as React from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
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
  profileUrl: string;
  personalLinks?: PersonalLink[];
};

export function ShareProfileDialog({
  open,
  onOpenChange,
  name,
  avatarSrc,
  subtitle,
  profileUrl,
  personalLinks,
}: ShareProfileDialogProps): JSX.Element {
  const [copied, setCopied] = React.useState(false);

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
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-dark/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-32px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-[#D9DEE3] bg-light shadow-2xl focus:outline-none">
          <div className="rounded-[24px] bg-light px-6 pb-8 pt-6 sm:px-8">
            <div className="relative mb-8 flex items-center justify-center">
              <Dialog.Title className="text-black text-center text-[36px] font-semibold leading-none">
                Share Profile
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-black absolute right-0 top-1/2 -translate-y-1/2 text-[28px] leading-none"
                  aria-label="Close share profile dialog"
                >
                  ×
                </button>
              </Dialog.Close>
            </div>

            <div className="mb-5 rounded-[20px] border border-[#E6E8EA] bg-light px-6 py-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#F5F5F5]">
                  <Image
                    src={avatarSrc || DefaultAvatarImgUrl}
                    alt={`Avatar of ${name}`}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-black truncate text-[18px] font-semibold">
                      {name}
                    </p>

                    {personalLinks?.map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${link.platform} profile`}
                        className="shrink-0"
                      >
                        <Image
                          src={`/profile/edit/${link.platform}-logo.svg`}
                          alt={link.platform}
                          width={18}
                          height={18}
                        />
                      </a>
                    ))}
                  </div>

                  {subtitle ? (
                    <p className="text-black mt-1 text-[14px] font-medium">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="share-profile-link"
                className="text-black mb-2 block text-[14px] font-medium"
              >
                Profile Link
              </label>

              <div className="flex items-center gap-3 rounded-[14px] border border-[#E6E8EA] bg-light px-4 py-3">
                <input
                  id="share-profile-link"
                  value={profileUrl}
                  readOnly
                  className="bg-transparent text-black flex-1 border-0 text-[14px] outline-none"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="text-black h-10 shrink-0 rounded-[10px] border border-[#D9DEE3] bg-light px-4 text-[14px] font-medium hover:bg-[#F8F8F8]"
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
