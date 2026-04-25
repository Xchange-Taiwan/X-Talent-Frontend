import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Props {
  isSaving: boolean;
  onBack: () => void;
  isMentorOnboarding?: boolean;
}

export function EditPageHeader({
  isSaving,
  onBack,
  isMentorOnboarding,
}: Props) {
  return (
    <div className="mb-10 flex justify-between">
      <div className="flex items-center gap-3">
        <ArrowBackIcon
          className={`sm:hidden ${isSaving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
          onClick={isSaving ? undefined : onBack}
        />
        <p className="whitespace-nowrap text-4xl font-bold">
          {isMentorOnboarding ? '完成個人資料' : '編輯個人頁面'}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="hidden grow rounded-full px-6 py-3 sm:inline-flex sm:grow-0"
          onClick={onBack}
          disabled={isSaving}
        >
          取消
        </Button>

        <Button
          type="submit"
          variant="default"
          className="w-[88px] rounded-full py-3 sm:w-auto sm:grow-0 sm:px-6"
          form="edit-profile-form"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              儲存中...
            </>
          ) : (
            '儲存'
          )}
        </Button>
      </div>
    </div>
  );
}
