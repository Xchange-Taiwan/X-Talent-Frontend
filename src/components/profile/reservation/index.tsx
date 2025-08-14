import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReservationDialog({
  open,
  onOpenChange,
}: ReservationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>預約視窗</DialogTitle>
          <DialogDescription>這裡可以放預約相關內容。</DialogDescription>
        </DialogHeader>
        <div className="mt-4">{/* 這裡放你的預約表單或內容 */}</div>
        <DialogClose asChild>
          <button className="mt-4 rounded bg-gray-200 px-4 py-2">關閉</button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
