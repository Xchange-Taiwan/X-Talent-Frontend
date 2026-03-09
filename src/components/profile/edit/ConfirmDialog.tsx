import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/components/ui/button';

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
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="bg-white fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-lg">
          <Dialog.Title className="text-center text-xl font-bold text-gray-900">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-center text-gray-600">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-center gap-4">
            <Dialog.Close asChild>
              <Button variant="destructive">取消</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button onClick={onConfirm}>確認</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
