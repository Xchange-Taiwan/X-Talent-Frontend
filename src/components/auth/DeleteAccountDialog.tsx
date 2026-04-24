'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import useDeleteAccountForm from '@/hooks/auth/useDeleteAccountForm';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps): JSX.Element {
  const router = useRouter();
  const {
    mode,
    xcForm,
    isSubmitting,
    blockedByReservations,
    onSubmitXC,
    initiateGoogleReauth,
  } = useDeleteAccountForm();

  const handleClose = (): void => {
    if (isSubmitting) return;
    xcForm.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">刪除帳號</DialogTitle>
          <DialogDescription>
            此操作無法復原。帳號刪除後，所有資料將永久移除。
          </DialogDescription>
        </DialogHeader>

        {blockedByReservations && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            您目前有未完成或未來的預約，請先處理後再刪除帳號。
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => {
                handleClose();
                router.push('/reservation/mentee');
              }}
            >
              前往預約管理
            </button>
          </div>
        )}

        {mode === 'google' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              系統將引導您前往 Google
              完成身分驗證，確認後帳號將被永久刪除且無法復原。
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={initiateGoogleReauth}
                disabled={isSubmitting}
              >
                {isSubmitting ? '處理中…' : '前往 Google 驗證並刪除帳號'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...xcForm}>
            <form
              onSubmit={xcForm.handleSubmit(onSubmitXC)}
              className="space-y-4"
            >
              <FormField
                control={xcForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電子郵件</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={xcForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>請輸入密碼確認身分</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="輸入您的登入密碼"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '處理中…' : '確認刪除帳號'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
