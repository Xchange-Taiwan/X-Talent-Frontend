'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JoinMeetButtonProps {
  onClick: () => void;
  isPending: boolean;
  disabled?: boolean;
  size?: ButtonProps['size'];
  className?: string;
}

/**
 * Shared by ReservationCard (upcoming tab) and ConfirmedReservationDialog
 * (mentor calendar). The meet-link fetch itself (useReservationMeetLink)
 * stays owned by each caller since ConfirmedReservationDialog also needs
 * `isPending` to disable its neighboring Cancel button.
 *
 * Brand color (bg-brand-500/text-text-primary/hover:bg-brand-500/90) comes
 * from Button's own `default` variant - callers should only pass
 * layout/spacing classes here, not re-specify the brand color.
 */
export function JoinMeetButton({
  onClick,
  isPending,
  disabled = false,
  size,
  className,
}: JoinMeetButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isPending || disabled}
      size={size}
      aria-label="加入 Google Meet"
      className={cn(className)}
    >
      {isPending ? (
        '載入中...'
      ) : (
        <>
          <span className="hidden sm:inline">加入 Google Meet</span>
          <span className="sm:hidden">加入會議</span>
        </>
      )}
    </Button>
  );
}
