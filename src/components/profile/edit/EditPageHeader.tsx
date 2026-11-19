import { Loader2 } from 'lucide-react';

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
    <header className="border-background-border bg-background-white mb-8 border-b">
      <div className="mx-auto flex w-11/12 max-w-[1160px] items-center justify-between gap-4 py-6">
        <div className="min-w-0">
          <span className="sr-only">{roleSubtitle}</span>
          <h1 className="text-text-primary truncate text-2xl font-semibold">
            {pageTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="text-text-primary h-10 rounded-md px-4 py-2 font-medium focus-visible:ring-offset-0"
            onClick={onBack}
            disabled={isSaving}
          >
            取消
          </Button>

          <Button
            type="submit"
            variant="default"
            className="bg-brand-500 text-text-primary hover:bg-brand-600 focus-visible:ring-brand-700 h-10 min-w-[96px] rounded-md px-4 py-2 font-medium whitespace-nowrap focus-visible:ring-offset-0"
            form="edit-profile-form"
            disabled={isSaving || submitDisabled}
          >
            {isSaving ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
                儲存中...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
