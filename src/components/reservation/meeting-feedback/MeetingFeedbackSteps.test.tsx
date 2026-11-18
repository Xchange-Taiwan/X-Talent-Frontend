import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { resolveMeetingFeedbackFooterModel } from '@/schemas/meetingFeedbackSchema';

import { MeetingFeedbackFooter } from './MeetingFeedbackSteps';

describe('MeetingFeedbackFooter with footerModel', () => {
  it('renders Step 1 next-step button and triggers onNextFromAttendance', () => {
    const onNext = vi.fn();
    const footerModel = resolveMeetingFeedbackFooterModel({
      step: 'attendance',
      role: 'mentee',
      values: { meetingHappened: true },
    });

    render(
      <Dialog open>
        <DialogContent>
          <MeetingFeedbackFooter
            footerModel={footerModel}
            onNextFromAttendance={onNext}
            onBackToAttendance={() => {}}
            onCancelEdit={() => {}}
          />
        </DialogContent>
      </Dialog>
    );

    const nextBtn = screen.getByRole('button', { name: '下一步' });
    expect(nextBtn).toHaveAttribute('type', 'button');
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders Step 2 queue primary action (送出並填下一場) and back button', () => {
    const onBack = vi.fn();
    const footerModel = resolveMeetingFeedbackFooterModel({
      step: 'rating',
      role: 'mentee',
      hasRemainingQueueCard: true,
      values: { meetingHappened: true, rating: 9, content: '' },
    });

    render(
      <Dialog open>
        <DialogContent>
          <MeetingFeedbackFooter
            footerModel={footerModel}
            onNextFromAttendance={() => {}}
            onBackToAttendance={onBack}
            onCancelEdit={() => {}}
          />
        </DialogContent>
      </Dialog>
    );

    expect(
      screen.getByRole('button', { name: '送出並填下一場' })
    ).toHaveAttribute('type', 'submit');

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders edit mode cancel and save actions cleanly', () => {
    const onCancel = vi.fn();
    const footerModel = resolveMeetingFeedbackFooterModel({
      mode: 'edit',
      step: 'rating',
      values: { meetingHappened: true, rating: 8, content: '已填寫' },
    });

    render(
      <Dialog open>
        <DialogContent>
          <MeetingFeedbackFooter
            footerModel={footerModel}
            onNextFromAttendance={() => {}}
            onBackToAttendance={() => {}}
            onCancelEdit={onCancel}
          />
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole('button', { name: '儲存' })).toHaveAttribute(
      'type',
      'submit'
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
