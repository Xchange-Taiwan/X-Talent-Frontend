import dayjs from 'dayjs';

export type RawMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  dtstart: number;
  dtend: number;
  rrule?: string | null;
  exdate?: string[] | null;
};

export type ParsedMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  start: Date;
  end: Date;
  durationMinutes: number;
  formatted: string;
};

export const useMentorSchedule = (
  timeslots: RawMentorTimeslot[]
): ParsedMentorTimeslot[] => {
  return timeslots.map((timeslot) => {
    const start = new Date(timeslot.dtstart * 1000);
    const end = new Date(timeslot.dtend * 1000);
    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60)
    );
    const startFormatted = dayjs(start).format('YYYY-MM-DD HH:mm');
    const endFormatted = dayjs(end).format('HH:mm');
    const formatted = `${startFormatted} ~ ${endFormatted}`;

    return {
      id: timeslot.id,
      type: timeslot.type,
      start,
      end,
      durationMinutes,
      formatted,
    };
  });
};

// Dummy data
export const dummyRawTimeslots: RawMentorTimeslot[] = [
  {
    id: 1,
    type: 'ALLOW',
    dtstart: 1724396400,
    dtend: 1724398200,
    rrule: null,
    exdate: null,
  },
  {
    id: 2,
    type: 'BLOCK',
    dtstart: 1724400000,
    dtend: 1724403600,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    exdate: ['20240830T090000Z'],
  },
  {
    id: 3,
    type: 'ALLOW',
    dtstart: 1724407200,
    dtend: 1724410800,
    rrule: null,
    exdate: null,
  },
  {
    id: 999,
    type: 'ALLOW',
    dtstart: 1755114000,
    dtend: 1755115800,
    rrule: null,
    exdate: null,
  },
];

export default useMentorSchedule;
