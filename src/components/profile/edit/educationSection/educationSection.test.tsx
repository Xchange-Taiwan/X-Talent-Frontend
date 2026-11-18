import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { Form, FormField } from '@/components/ui/form';
import {
  createProfileFormSchema,
  defaultValues,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';

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

describe('EducationSection collapsible summary-row mode for Mentee (#828)', () => {
  function EduHarness() {
    const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
      resolver: zodResolver(createProfileFormSchema(false)),
      defaultValues: {
        ...defaultValues,
        is_mentor: false,
        educations: [
          {
            id: 1,
            school: '國立臺灣科技大學',
            subject: '設計系',
            education_period_start: '2015',
            education_period_end: '2019',
          },
        ],
      },
    });
    return (
      <Form {...form}>
        <form>
          <EducationSection form={form} isMentor={false} collapsible={true} />
        </form>
      </Form>
    );
  }

  it('renders collapsed education summary row and expands on 編輯 click', () => {
    render(<EduHarness />);

    expect(
      screen.getAllByText('國立臺灣科技大學').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/設計系 · 2015 – 2019/)).toBeInTheDocument();
    expect(screen.getByLabelText('主修')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    expect(screen.getByLabelText('主修')).toBeVisible();
    expect(screen.getByLabelText('主修')).toHaveValue('設計系');

    fireEvent.click(screen.getByRole('button', { name: '收合' }));
    expect(screen.getByLabelText('主修')).not.toBeVisible();
  });
});
