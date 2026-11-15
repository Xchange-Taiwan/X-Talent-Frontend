import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '@/components/ui/use-toast';
import {
  defaultValues,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';

import {
  type RepeatablePeriodConfig,
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from './useRepeatablePeriodSection';

const toastMock = vi.fn();

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

describe('useRepeatablePeriodSection', () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  const setupWorkHook = (
    initialValues: Partial<ProfileFormValues> = {},
    config: Partial<RepeatablePeriodConfig<'work_experiences'>> = {}
  ) => {
    const defaultConfig: RepeatablePeriodConfig<'work_experiences'> = {
      arrayName: 'work_experiences',
      isIncompleteForAppend: (last) =>
        !last?.job ||
        !last?.company ||
        !last?.job_period_start ||
        !last?.job_period_end,
      incompleteAlertMessage: 'Please complete the last job',
    };

    const finalConfig = { ...defaultConfig, ...config };

    const { result } = renderHook(() => {
      const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
        defaultValues: {
          ...defaultValues,
          ...initialValues,
        },
      });
      const hookResult = useRepeatablePeriodSection(form, finalConfig);
      return { hookResult, form };
    });

    return result;
  };

  it('exports descending YEAR_OPTIONS from current year down to 1940', () => {
    const currentYear = new Date().getFullYear();
    expect(YEAR_OPTIONS[0]).toBe(currentYear.toString());
    expect(YEAR_OPTIONS[YEAR_OPTIONS.length - 1]).toBe('1940');
    expect(YEAR_OPTIONS).toHaveLength(currentYear - 1940 + 1);
  });

  it('appends directly when the field array is initially empty', () => {
    const result = setupWorkHook({ work_experiences: [] });

    expect(result.current.hookResult.fields).toHaveLength(0);

    act(() => {
      result.current.hookResult.tryAppend({
        id: -1,
        job: '',
        company: '',
        job_period_start: '',
        job_period_end: 'now',
        industry: '',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      });
    });

    expect(toastMock).not.toHaveBeenCalled();
    expect(result.current.hookResult.fields).toHaveLength(1);
  });

  it('handles field appending, moving, and removal when the previous item is complete', () => {
    const result = setupWorkHook({
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'XChange',
          job_period_start: '2020',
          job_period_end: '2021',
          industry: 'Tech',
          job_location: 'TWN',
          description: 'Backend',
          is_primary: true,
        },
      ],
    });

    expect(result.current.hookResult.fields).toHaveLength(1);

    act(() => {
      result.current.hookResult.tryAppend({
        id: -1,
        job: 'Lead Engineer',
        company: 'Acme',
        job_period_start: '2022',
        job_period_end: 'now',
        industry: 'Tech',
        job_location: 'TWN',
        description: 'Platform',
        is_primary: false,
      });
    });

    expect(result.current.hookResult.fields).toHaveLength(2);

    act(() => {
      result.current.hookResult.move(0, 1);
    });
    expect(result.current.form.getValues('work_experiences.0.job')).toBe(
      'Lead Engineer'
    );

    act(() => {
      result.current.hookResult.remove(0);
    });
    expect(result.current.hookResult.fields).toHaveLength(1);
    expect(result.current.form.getValues('work_experiences.0.job')).toBe(
      'Engineer'
    );
  });

  it('triggers destructive toast on tryAppend if the last entry is incomplete', () => {
    const { toast } = useToast();
    const result = setupWorkHook({
      work_experiences: [
        {
          id: 1,
          job: '',
          company: '',
          job_period_start: '2020',
          job_period_end: '2021',
          industry: 'Tech',
          job_location: 'TWN',
          description: '',
          is_primary: true,
        },
      ],
    });

    act(() => {
      result.current.hookResult.tryAppend({
        id: -1,
        job: '',
        company: '',
        job_period_start: '',
        job_period_end: 'now',
        industry: '',
        job_location: 'TWN',
        description: '',
        is_primary: false,
      });
    });

    expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'Please complete the last job',
    });
    expect(result.current.hookResult.fields).toHaveLength(1);
  });
});
