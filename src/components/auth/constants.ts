import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export const linkStyle = cn(
  'text-sm font-medium text-text-primary underline underline-offset-2 cursor-pointer rounded-sm',
  FOCUS_RING_CLASSES
);
