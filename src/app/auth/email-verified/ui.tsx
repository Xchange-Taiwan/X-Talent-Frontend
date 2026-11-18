import AuthCard from '@/components/auth/AuthCard';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailVerifiedPresentationProps {
  icon: string;
  title: string;
  content: string;
  btnContent: string;
  onSetProfile: () => void;
}

export function EmailVerifiedLoadingCard() {
  return (
    <AuthCard
      showBanner
      bannerContent={
        <div className="border-background-border bg-background-white absolute bottom-0 left-1/2 flex h-20 w-20 -translate-x-1/2 translate-y-2/3 items-center justify-center rounded-full border">
          <LoadingSpinner size="md" label="驗證信箱中" />
        </div>
      }
      contentClassName="text-center"
    >
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-6 w-72 max-w-full" />
      <Skeleton className="h-10 w-[135px] rounded-full" />
    </AuthCard>
  );
}

export default function EmailVerifiedPresentation({
  icon,
  title,
  content,
  btnContent,
  onSetProfile,
}: EmailVerifiedPresentationProps) {
  return (
    <AuthMessageCard icon={icon} iconAlt="Verify Email" title={title}>
      <p className="text-text-secondary">{content}</p>

      <Button
        shape="pill"
        className="min-w-[135px] px-6"
        onClick={onSetProfile}
      >
        {btnContent}
      </Button>
    </AuthMessageCard>
  );
}
