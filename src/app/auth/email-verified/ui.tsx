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
      <p className="text-neutral-600">{content}</p>

      <Button className="max-w-60 rounded-full" onClick={onSetProfile}>
        {btnContent}
      </Button>
    </AuthMessageCard>
  );
}
