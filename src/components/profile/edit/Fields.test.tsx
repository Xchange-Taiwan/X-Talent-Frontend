import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { Form } from '@/components/ui/form';

import { ComboboxField } from './Fields';

interface FormValues {
  location: string;
}

const manyOptions = Array.from({ length: 249 }, (_, i) => ({
  value: `country-${i}`,
  label: `Country ${i}`,
}));

function Harness({ defaultValue = '' }: { defaultValue?: string }) {
  const form = useForm<FormValues>({
    defaultValues: { location: defaultValue },
  });
  return (
    <Form {...form}>
      <form>
        <ComboboxField
          form={form}
          name="location"
          placeholder="請選擇地區"
          searchPlaceholder="搜尋地區"
          options={manyOptions}
        />
      </form>
    </Form>
  );
}

describe('ComboboxField', () => {
  it('does not mount any option on initial render, even with hundreds of options', () => {
    render(<Harness />);

    expect(screen.queryByText('Country 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Country 248')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[cmdk-item]')).toHaveLength(0);
  });

  it('shows the placeholder when nothing is selected', () => {
    render(<Harness />);

    expect(screen.getByText('請選擇地區')).toBeInTheDocument();
  });

  it('shows the selected option label without opening the popover', () => {
    render(<Harness defaultValue="country-7" />);

    expect(screen.getByText('Country 7')).toBeInTheDocument();
  });

  it('mounts the option list once opened, and lets the user pick a value', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Country 0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Country 3'));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Country 3');
    });
  });
});
