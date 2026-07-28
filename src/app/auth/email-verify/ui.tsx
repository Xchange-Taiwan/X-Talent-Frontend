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
      icon={EmailVerifyIconUrl.src}
      iconAlt="Verify Email"
      title="驗證信箱"
      contentClassName="px-6 pb-8 pt-16 text-center md:p-20"
    >
      <p className="text-neutral-600">
        已傳送一封驗證信，點選連結以完成帳號註冊。
      </p>

      <Button shape="pill" className="max-w-60" onClick={onNavigateHome}>
        回首頁
      </Button>

      <p className="text-xs text-text-tertiary">
        沒有收到信嗎？{' '}
        <span
          className="cursor-pointer underline decoration-1"
          onClick={onResendEmail}
        >
          點此重新寄送
        </span>
      </p>
    </AuthMessageCard>
  );
}
