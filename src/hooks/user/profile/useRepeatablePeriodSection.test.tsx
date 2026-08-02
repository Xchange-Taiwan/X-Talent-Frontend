import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { useToast } from '@/components/ui/use-toast';
import { ProfileFormInput, ProfileFormValues } from '@/schemas/profileSchema';

import {
  RepeatablePeriodConfig,
  useRepeatablePeriodSection,
  YEAR_OPTIONS,
} from './useRepeatablePeriodSection';

vi.mock('@/components/ui/use-toast', () => {
  const toastMock = vi.fn();
  return {
    useToast: () => ({
      toast: toastMock,
    }),
  };
});

describe('useRepeatablePeriodSection', () => {
  const setupHook = (
    initialValues: Partial<ProfileFormValues> = {},
    config: Partial<RepeatablePeriodConfig<'work_experiences'>> = {},
    onValidationChange = vi.fn()
  ) => {
    const defaultConfig: RepeatablePeriodConfig<'work_experiences'> = {
      arrayName: 'work_experiences',
      periodStartKey: 'job_period_start',
      periodEndKey: 'job_period_end',
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
          work_experiences: [],
          ...initialValues,
        } as unknown as ProfileFormInput,
      });
      const hookResult = useRepeatablePeriodSection(
        form,
        finalConfig,
        onValidationChange
      );
      return { hookResult, form };
    });

    return result;
  };

  it('exports correct static YEAR_OPTIONS', () => {
    const currentYear = new Date().getFullYear();
    expect(YEAR_OPTIONS).toContain(currentYear.toString());
    expect(YEAR_OPTIONS).toContain('1940');
  });

  it('handles field appending, removal, and moving', () => {
    const result = setupHook({
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'Xchange',
          job_period_start: '2020',
          job_period_end: '2021',
          industry: 'Tech',
          job_location: 'TWN',
          description: '',
        } as unknown as ProfileFormValues['work_experiences'][number],
      ],
    });

    expect(result.current.hookResult.fields).toHaveLength(1);

    // Try appending when the last one is complete
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
      } as unknown as ProfileFormValues['work_experiences'][number]);
    });

    expect(result.current.hookResult.fields).toHaveLength(2);

    // Swap fields via move
    act(() => {
      result.current.hookResult.move(0, 1);
    });

    // Remove field
    act(() => {
      result.current.hookResult.remove(0);
    });

    expect(result.current.hookResult.fields).toHaveLength(1);
  });

  it('triggers toast on tryAppend if the last entry is incomplete', () => {
    const { toast } = useToast();
    const result = setupHook({
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
        } as unknown as ProfileFormValues['work_experiences'][number],
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
      } as unknown as ProfileFormValues['work_experiences'][number]);
    });

    expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'Please complete the last job',
    });
    expect(result.current.hookResult.fields).toHaveLength(1);
  });

  it('validates period and calls onValidationChange', () => {
    const onValidationChange = vi.fn();
    const result = setupHook(
      {
        work_experiences: [
          {
            id: 1,
            job: 'Engineer',
            company: 'X',
            job_period_start: '2022',
            job_period_end: '2021',
          } as unknown as ProfileFormValues['work_experiences'][number],
        ],
      },
      {},
      onValidationChange
    );

    expect(onValidationChange).toHaveBeenCalledWith(true);
    expect(result.current.hookResult.isInvalidPeriod(0)).toBe(true);
  });

  it('allows "now" as a valid end period without triggering error', () => {
    const onValidationChange = vi.fn();
    const result = setupHook(
      {
        work_experiences: [
          {
            id: 1,
            job: 'Engineer',
            company: 'X',
            job_period_start: '2022',
            job_period_end: 'now',
          } as unknown as ProfileFormValues['work_experiences'][number],
        ],
      },
      {},
      onValidationChange
    );

    expect(onValidationChange).toHaveBeenCalledWith(false);
    expect(result.current.hookResult.isInvalidPeriod(0)).toBe(false);
  });

  it('allows valid sequential year periods without triggering error', () => {
    const onValidationChange = vi.fn();
    const result = setupHook(
      {
        work_experiences: [
          {
            id: 1,
            job: 'Engineer',
            company: 'X',
            job_period_start: '2020',
            job_period_end: '2025',
          } as unknown as ProfileFormValues['work_experiences'][number],
        ],
      },
      {},
      onValidationChange
    );

    expect(onValidationChange).toHaveBeenCalledWith(false);
    expect(result.current.hookResult.isInvalidPeriod(0)).toBe(false);
  });
});
