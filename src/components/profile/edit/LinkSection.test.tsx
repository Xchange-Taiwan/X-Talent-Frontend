import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form } from '@/components/ui/form';
import {
  createProfileFormSchema,
  defaultValues,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';

import { LinksSection } from './LinkSection';

function LinksSectionHarness({
  isMentor,
  initialLinks,
  onValidSubmit,
}: {
  isMentor: boolean;
  initialLinks?: Partial<ProfileFormValues['links']>;
  onValidSubmit?: (values: ProfileFormValues) => void;
}) {
  const schema = createProfileFormSchema(isMentor);
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      is_mentor: isMentor,
      name: '測試使用者',
      about: isMentor ? '導師自我介紹' : '',
      location: 'TWN',
      years_of_experience: 'BELOW_ONE_YEAR',
      industry: isMentor ? 'TECH' : '',
      want_position: ['FE'],
      want_skill: ['REACT'],
      want_topic: ['CAREER'],
      have_skill: isMentor ? ['REACT'] : [],
      have_topic: isMentor ? ['CAREER'] : [],
      work_experiences: isMentor
        ? [
            {
              id: 0,
              job: 'Engineer',
              company: 'Acme',
              job_period_start: '2022',
              job_period_end: 'now',
              industry: 'TECH',
              job_location: 'TWN',
              description: '前端開發',
              is_primary: true,
            },
          ]
        : [],
      educations: isMentor
        ? [
            {
              id: 0,
              school: '國立臺灣大學',
              subject: '資訊工程學系',
              education_period_start: '2018',
              education_period_end: '2022',
            },
          ]
        : [],
      links: {
        ...defaultValues.links,
        ...initialLinks,
      },
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onValidSubmit?.(values))}>
        <LinksSection form={form} />
        <button type="submit">儲存</button>
      </form>
    </Form>
  );
}

describe('LinksSection (#862)', () => {
  it.each([false, true])(
    'renders all 7 social link fields in canonical order (GitHub between YouTube and 個人網站) when isMentor=%s',
    (isMentor) => {
      render(<LinksSectionHarness isMentor={isMentor} />);

      const labels = screen
        .getAllByText(
          /^(LinkedIn|Facebook|Instagram|X \(formerly Twitter\)|YouTube|GitHub|個人網站)$/
        )
        .map((el) => el.textContent);

      expect(labels).toEqual([
        'LinkedIn',
        'Facebook',
        'Instagram',
        'X (formerly Twitter)',
        'YouTube',
        'GitHub',
        '個人網站',
      ]);
    }
  );

  it('blocks non-github.com URLs with error message and normalizes scheme-omitted github.com URL while preserving Facebook', async () => {
    const onValidSubmit = vi.fn();
    render(
      <LinksSectionHarness
        isMentor={false}
        initialLinks={{ facebook: 'https://www.facebook.com/octocat' }}
        onValidSubmit={onValidSubmit}
      />
    );

    const githubInput = screen.getByLabelText('GitHub');
    fireEvent.change(githubInput, {
      target: { value: 'https://gitlab.com/octocat' },
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    expect(
      await screen.findByText(
        '請輸入有效的 GitHub HTTPS 網址（允許網域：github.com）'
      )
    ).toBeInTheDocument();
    expect(onValidSubmit).not.toHaveBeenCalled();

    fireEvent.change(githubInput, {
      target: { value: 'github.com/octocat' },
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => {
      expect(onValidSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onValidSubmit.mock.calls[0]?.[0]?.links).toEqual({
      ...defaultValues.links,
      facebook: 'https://www.facebook.com/octocat',
      github: 'https://github.com/octocat',
    });
  });
});
