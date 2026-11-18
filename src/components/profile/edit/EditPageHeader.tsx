import { ChevronLeft, Loader2 } from 'lucide-react';

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
  const roleSubtitle =
    isMentorOnboarding || isMentor ? '導師個人資料' : '學員個人資料';
  const pageTitle = isMentorOnboarding
    ? '建立導師資料'
    : isMentor
      ? '編輯導師資料'
      : '編輯個人資訊';
  const submitLabel = isMentorOnboarding ? '儲存並建立' : '儲存變更';

  return (
    <div className="border-background-border bg-light/95 supports-[backdrop-filter]:bg-light/80 sticky top-[70px] z-20 mb-8 flex items-center justify-between gap-4 border-b py-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <ChevronLeft
          className={`shrink-0 sm:hidden ${isSaving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
          onClick={isSaving ? undefined : onBack}
        />
        <div className="min-w-0">
          <p className="text-text-tertiary text-xs font-medium">
            {roleSubtitle}
          </p>
          <h1 className="text-text-primary truncate text-2xl font-bold sm:text-3xl">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <Button
          type="button"
          variant="outline"
          className="hidden rounded-full px-6 py-2.5 sm:inline-flex"
          onClick={onBack}
          disabled={isSaving}
        >
          取消
        </Button>

        <Button
          type="submit"
          variant="default"
          className="min-w-[104px] rounded-full px-5 py-2.5 whitespace-nowrap sm:px-6"
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
  );
}
