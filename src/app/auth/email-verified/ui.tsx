import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { Button } from '@/components/ui/button';

interface EmailVerifiedPresentationProps {
  icon: string;
  title: string;
  content: string;
  btnContent: string;
  onSetProfile: () => void;
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
