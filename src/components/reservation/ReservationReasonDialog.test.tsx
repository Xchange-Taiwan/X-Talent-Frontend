import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import { FOCUS_WITHIN_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import type { Reservation } from '@/types/reservation';

import { ReservationReasonDialog } from './ReservationReasonDialog';

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

const reservation: Reservation = {
  id: 'res-977',
  name: 'Dana Mentor',
  roleLine: 'Mentor',
  date: '2026-08-10',
  time: '2:00 PM – 2:30 PM',
  dtstart: Math.floor(new Date('2026-08-10T14:00:00Z').getTime() / 1000),
  dtend: Math.floor(new Date('2026-08-10T14:30:00Z').getTime() / 1000),
  messages: [],
  scheduleId: 977,
  version: 1,
  senderUserId: 'user-mentee',
  participantUserId: 'user-mentor',
};

const KIND_CASES = [
  {
    kind: 'reject' as const,
    trigger: '拒絕',
    title: '拒絕學員預約的原因',
    description: '請說明無法接受此預約的原因。',
    placeholder: '請在此輸入原因...',
    dismiss: '取消',
    dialog: 'reject_reservation',
  },
  {
    kind: 'cancel' as const,
    trigger: '取消預約',
    title: '取消預約',
    description: '請說明取消預約的原因。',
    placeholder: '您好 Dana，...',
    dismiss: '維持預約',
    dialog: 'cancel_reservation',
  },
];

function openDialog(trigger: string) {
  fireEvent.click(screen.getByRole('button', { name: trigger }));
}

function getConfirm(name: string) {
  const buttons = screen.getAllByRole('button', { name });
  return buttons[buttons.length - 1];
}

describe('ReservationReasonDialog (#977)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each(KIND_CASES)('kind="$kind"', (c) => {
    it('renders the kind-specific copy and tracks feature_opened on open', () => {
      render(
        <ReservationReasonDialog kind={c.kind} reservation={reservation} />
      );

      openDialog(c.trigger);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: c.title })
      ).toBeInTheDocument();
      expect(screen.getByText(c.description)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(c.placeholder)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: c.dismiss })
      ).toBeInTheDocument();
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: c.dialog },
      });
    });

    it('wraps the textarea in the unified no-offset focus-within ring and masks it for Clarity', () => {
      render(
        <ReservationReasonDialog kind={c.kind} reservation={reservation} />
      );
      openDialog(c.trigger);

      const textarea = screen.getByPlaceholderText(c.placeholder);
      const wrapper = textarea.parentElement as HTMLElement;
      for (const cls of FOCUS_WITHIN_RING_NO_OFFSET_CLASSES.split(/\s+/)) {
        expect(wrapper).toHaveClass(cls);
      }
      expect(wrapper.className).not.toMatch(/ring-offset-(?!0)/);
      expect(wrapper).toHaveAttribute('data-clarity-mask', 'true');
      expect(textarea).toHaveClass('focus-visible:ring-0');
    });

    it('disables confirm until a non-blank reason is typed, then submits the trimmed reason and closes on success', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ ok: true });
      render(
        <ReservationReasonDialog
          kind={c.kind}
          reservation={reservation}
          onSubmit={onSubmit}
        />
      );
      openDialog(c.trigger);

      const confirm = getConfirm(c.trigger);
      expect(confirm).toBeDisabled();

      const textarea = screen.getByPlaceholderText(c.placeholder);
      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(confirm).toBeDisabled();

      fireEvent.change(textarea, { target: { value: '  臨時有事  ' } });
      expect(confirm).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(confirm);
      });

      expect(onSubmit).toHaveBeenCalledWith({
        id: 'res-977',
        reason: '臨時有事',
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays open with the draft intact when the adapter resolves a named failure', async () => {
      const onSubmit = vi.fn().mockResolvedValue({
        ok: false,
        kind: c.kind,
        reason: 'version_conflict',
        message: '資料已被更新，請重新確認後再試一次',
      });
      render(
        <ReservationReasonDialog
          kind={c.kind}
          reservation={reservation}
          onSubmit={onSubmit}
        />
      );
      openDialog(c.trigger);

      const textarea = screen.getByPlaceholderText(c.placeholder);
      fireEvent.change(textarea, { target: { value: '原因' } });
      await act(async () => {
        fireEvent.click(getConfirm(c.trigger));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(textarea).toHaveValue('原因');
      expect(getConfirm(c.trigger)).not.toBeDisabled();
    });
  });

  it('stays open (no unhandled rejection) when a legacy callback throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <ReservationReasonDialog
        kind="reject"
        reservation={reservation}
        onSubmit={onSubmit}
      />
    );
    openDialog('拒絕');
    fireEvent.change(screen.getByPlaceholderText('請在此輸入原因...'), {
      target: { value: '原因' },
    });
    await act(async () => {
      fireEvent.click(getConfirm('拒絕'));
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('locks dismissal and shows the spinner while submitting, and resets the draft on reopen', async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );
    render(
      <ReservationReasonDialog
        kind="cancel"
        reservation={reservation}
        onSubmit={onSubmit}
      />
    );
    openDialog('取消預約');
    fireEvent.change(screen.getByPlaceholderText('您好 Dana，...'), {
      target: { value: '原因' },
    });
    await act(async () => {
      fireEvent.click(getConfirm('取消預約'));
    });

    expect(screen.getByRole('button', { name: '維持預約' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      resolveSubmit({ ok: false, reason: 'in_flight' });
    });
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openDialog('取消預約');
    expect(screen.getByPlaceholderText('您好 Dana，...')).toHaveValue('');
  });

  it('disables the trigger when disabled is true', () => {
    render(
      <ReservationReasonDialog
        kind="reject"
        reservation={reservation}
        disabled
      />
    );
    expect(screen.getByRole('button', { name: '拒絕' })).toBeDisabled();
  });
});
