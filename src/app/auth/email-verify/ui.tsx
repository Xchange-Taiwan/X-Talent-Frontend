import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { Button } from '@/components/ui/button';

interface EmailVerificationPageProps {
  onResendEmail: () => void;
  onNavigateHome: () => void;
}

export default function EmailVerificationPage({
  onResendEmail,
  onNavigateHome,
}: EmailVerificationPageProps) {
  return (
    <AuthMessageCard
      icon={EmailVerifyIconUrl.src ?? EmailVerifyIconUrl}
      iconAlt="Verify Email"
      title="驗證信箱"
    >
      <p className="text-text-secondary">
        已傳送一封驗證信，點選連結以完成帳號註冊。
      </p>

      <Button
        shape="pill"
        className="min-w-[135px] px-6"
        onClick={onNavigateHome}
      >
        回首頁
      </Button>

      <p className="text-text-tertiary text-xs">
        沒有收到信嗎？{' '}
        <button
          type="button"
          className="text-text-tertiary hover:text-text-secondary inline cursor-pointer border-0 bg-transparent p-0 text-xs underline decoration-1"
          onClick={onResendEmail}
        >
          點此重新寄送
        </button>
      </p>
    </AuthMessageCard>
  );
}
