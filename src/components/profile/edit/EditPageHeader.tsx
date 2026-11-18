'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export interface EditPageHeaderProps {
  isSaving: boolean;
  onBack: () => void;
  isMentorOnboarding?: boolean;
  isMentor?: boolean;
  submitDisabled?: boolean;
}

export function EditPageHeader({
  isSaving,
  onBack,
  isMentorOnboarding = false,
  isMentor = false,
  submitDisabled = false,
}: EditPageHeaderProps) {
  const pageTitle = isMentorOnboarding
    ? '建立導師資料'
    : isMentor
      ? '編輯導師資料'
      : '編輯個人資訊';
  const submitLabel = isMentorOnboarding ? '儲存並建立' : '儲存變更';

  const [showFloatingFooter, setShowFloatingFooter] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      setShowFloatingFooter(window.scrollY > 180);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className="border-background-border mb-8 flex items-center justify-between gap-4 border-b py-6">
        <div className="flex min-w-0 items-center gap-3">
          <ChevronLeft
            className={`shrink-0 sm:hidden ${isSaving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            onClick={isSaving ? undefined : onBack}
          />
          <h1 className="text-text-primary truncate text-2xl font-bold sm:text-[28px]">
            {pageTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            className="text-text-primary hidden rounded-lg px-4 py-2.5 font-medium sm:inline-flex"
            onClick={onBack}
            disabled={isSaving}
          >
            取消
          </Button>

          <Button
            type="submit"
            variant="default"
            className="min-w-[104px] rounded-lg px-5 py-2.5 whitespace-nowrap"
            form="edit-profile-form"
            disabled={isSaving || submitDisabled}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                儲存中...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>

      {showFloatingFooter && (
        <div
          data-testid="edit-floating-footer"
          className="border-background-border bg-background-white/95 fixed inset-x-0 bottom-0 z-30 border-t py-3 backdrop-blur-xs"
        >
          <div className="mx-auto flex w-11/12 max-w-[1160px] items-center justify-between gap-4">
            <span className="text-text-secondary truncate text-sm font-medium">
              {pageTitle}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="text-text-primary rounded-lg px-4 py-2 font-medium"
                onClick={onBack}
                disabled={isSaving}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="default"
                className="min-w-[104px] rounded-lg px-5 py-2 whitespace-nowrap"
                form="edit-profile-form"
                disabled={isSaving || submitDisabled}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    儲存中...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
