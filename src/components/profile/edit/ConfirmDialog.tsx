import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContentFrame,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  trigger: React.ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-background-white/50 backdrop-blur-sm" />
        <DialogContentFrame className="w-[90vw] max-w-md gap-0 rounded-2xl border-none sm:rounded-2xl">
          <DialogTitle className="text-text-primary text-center text-xl font-bold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-text-secondary mt-2 text-center">
            {description}
          </DialogDescription>
          <div className="mt-6 flex justify-center gap-4">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={onConfirm}>
                確認
              </Button>
            </DialogClose>
          </div>
        </DialogContentFrame>
      </DialogPortal>
    </Dialog>
  );
}
