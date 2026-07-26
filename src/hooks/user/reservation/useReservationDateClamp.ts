import { useCallback } from 'react';

import { toDateKey } from '@/lib/profile/scheduleFormatters';

interface UseReservationDateClampParams {
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  year: number;
  setYear: (year: number) => void;
  month: number;
  setMonth: (month: number) => void;
  openReservationDialog: boolean;
}

export function useReservationDateClamp({
  selectedDate,
  setSelectedDate,
  year,
  setYear,
  month,
  setMonth,
  openReservationDialog,
}: UseReservationDateClampParams) {
  const handleScheduleMonthChange = useCallback(
    (date: Date) => {
      const newYear = date.getFullYear();
      const newMonth = date.getMonth() + 1;
      setYear(newYear);
      setMonth(newMonth);

      // Carry the viewed month into the booking dialogs by anchoring
      // selectedDate to the new month. Skip while a dialog is open so
      // in-dialog month navigation does not clobber the user's day pick.
      // Clamp to today so a past month never anchors to an un-editable
      // past day (which would let the dialog render its slot editor on
      // a date the mentor cannot configure).
      if (!openReservationDialog) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(newYear, newMonth - 1, 1);
        const anchor = monthStart < today ? today : monthStart;
        setSelectedDate(toDateKey(anchor));
      }
    },
    [openReservationDialog, setSelectedDate, setYear, setMonth]
  );

  const clampSelectedDateToToday = useCallback(() => {
    if (!selectedDate) return;
    const sel = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sel < today) {
      setSelectedDate(toDateKey(today));
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth() + 1;
      if (todayYear !== year || todayMonth !== month) {
        setYear(todayYear);
        setMonth(todayMonth);
      }
    }
  }, [selectedDate, setSelectedDate, year, month, setYear, setMonth]);

  return {
    handleScheduleMonthChange,
    clampSelectedDateToToday,
  };
}
