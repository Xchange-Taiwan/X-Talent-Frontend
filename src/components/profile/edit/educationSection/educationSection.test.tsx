import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { Form, FormField } from '@/components/ui/form';
import {
  createProfileFormSchema,
  defaultValues,
  type educationSchema,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { EducationSection, SchoolComboboxField } from './educationSection';

interface FormValues {
  school: string;
}

function Harness({ defaultValue = '' }: { defaultValue?: string }) {
  const form = useForm<FormValues>({ defaultValues: { school: defaultValue } });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="school"
          render={({ field }) => <SchoolComboboxField field={field} />}
        />
      </form>
    </Form>
  );
}

const SEARCH_PLACEHOLDER = '搜尋學校...';

describe('SchoolComboboxField', () => {
  it('lists known schools when opened', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('國立臺灣大學')).toBeInTheDocument();
    });
  });

  it('filters the list as the user types', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByPlaceholderText(SEARCH_PLACEHOLDER));

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: '成功' },
    });

    await waitFor(() => {
      expect(screen.getByText('國立成功大學')).toBeInTheDocument();
      expect(screen.queryByText('國立臺灣大學')).not.toBeInTheDocument();
    });
  });

  it('offers to create a custom school when nothing matches, and selecting it sets the value', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByPlaceholderText(SEARCH_PLACEHOLDER));

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'MIT' },
    });

    await waitFor(() => {
      expect(screen.getByText('新增「MIT」')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新增「MIT」'));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('MIT');
    });
  });

  it('does not offer to create a school that already exactly matches the list', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByPlaceholderText(SEARCH_PLACEHOLDER));

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: '國立臺灣大學' },
    });

    await waitFor(() => {
      expect(screen.getByText('國立臺灣大學')).toBeInTheDocument();
      expect(screen.queryByText(/^新增「/)).not.toBeInTheDocument();
    });
  });

  it('discards an unconfirmed typed value when the popover closes without an explicit pick', async () => {
    render(<Harness defaultValue="國立臺灣大學" />);

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByPlaceholderText(SEARCH_PLACEHOLDER));

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'MIT' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('國立臺灣大學');
    });
  });
});

type EducationEntry = z.infer<typeof educationSchema>;

function EducationSectionHarness({
  initialItems = [],
  isMentor = true,
}: {
  initialItems?: EducationEntry[];
  isMentor?: boolean;
}) {
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(isMentor)),
    defaultValues: {
      ...defaultValues,
      is_mentor: isMentor,
      educations: initialItems,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <EducationSection form={form} isMentor={isMentor} />
      </form>
    </Form>
  );
}

describe('EducationSection (#959)', () => {
  it('shows empty guidance for Mentor, adds education entries, reorders via 調整順序, and allows Mentee to delete their last optional entry', async () => {
    const { unmount } = render(<EducationSectionHarness isMentor />);
    expect(screen.getByText('請新增至少一項教育經歷')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新增教育經歷' }));
    await waitFor(() => {
      expect(screen.getByLabelText('主修')).toHaveValue('');
    });
    expect(
      screen.queryByRole('button', { name: '移除' })
    ).not.toBeInTheDocument();
    unmount();

    const twoEntries: EducationEntry[] = [
      {
        id: 1,
        school: '國立臺灣大學',
        subject: '資訊工程學系',
        education_period_start: '2016',
        education_period_end: '2020',
      },
      {
        id: 2,
        school: '國立成功大學',
        subject: '電機工程學系',
        education_period_start: '2020',
        education_period_end: '2022',
      },
    ];

    const { unmount: unmountTwo } = render(
      <EducationSectionHarness initialItems={twoEntries} isMentor />
    );
    expect(screen.getByText('第 1 筆／共 2 筆')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: '調整第 1 筆教育經歷順序' })
    );
    fireEvent.click(screen.getByRole('button', { name: '移到最後' }));
    await waitFor(() => {
      expect(screen.getAllByLabelText('主修')[0]).toHaveValue('電機工程學系');
    });
    unmountTwo();

    // Mentee can delete their sole optional education entry
    render(
      <EducationSectionHarness
        initialItems={[twoEntries[0]]}
        isMentor={false}
      />
    );
    expect(screen.getByText('選填')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('主修')).not.toBeInTheDocument();
    });
  });
});
