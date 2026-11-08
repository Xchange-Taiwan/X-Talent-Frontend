import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  EducationSection,
  ExperienceSection,
  WorkExperienceSection,
} from './ExperienceSection';

const NL = String.fromCharCode(10);

describe('ExperienceSection (#857)', () => {
  it('renders work experience descriptions with whitespace-pre-line and break-words', () => {
    const multilineDescription = [
      '負責大型分散式系統架構：',
      '1. 提升系統吞吐量 40%',
      '2. 建立跨區容災機制 https://example.com/very/long/architecture/url',
    ].join(NL);

    render(
      <WorkExperienceSection
        workExperiences={[
          {
            job: 'Staff Backend Engineer',
            company: 'Cloud Corp',
            job_period_start: '2021',
            job_period_end: '至今',
            job_location: 'TWN',
            industry: 'TECH',
            is_primary: true,
            description: multilineDescription,
          },
        ]}
      />
    );

    const heading = screen.getByRole('heading', {
      name: 'Staff Backend Engineer',
    });
    const descriptionParagraph = heading.nextElementSibling;

    expect(descriptionParagraph).toBeInTheDocument();
    expect(descriptionParagraph).toHaveClass(
      'whitespace-pre-line',
      'break-words'
    );
    expect(descriptionParagraph?.textContent).toBe(multilineDescription);
  });

  it('omits description paragraph when description is empty', () => {
    render(
      <EducationSection
        educations={[
          {
            subject: '資訊工程學系',
            school: '國立臺灣大學',
            education_period_start: '2017',
            education_period_end: '2021',
          },
        ]}
      />
    );

    const heading = screen.getByRole('heading', { name: '資訊工程學系' });
    expect(heading.nextElementSibling).toBeNull();
  });

  it('renders multiple items in ExperienceSection with dividers between items', () => {
    render(
      <ExperienceSection
        items={[
          {
            title: 'Role A',
            subtitle: 'Company A',
            startDate: '2020',
            endDate: '2022',
            description: ['Line 1', 'Line 2'].join(NL),
          },
          {
            title: 'Role B',
            subtitle: 'Company B',
            startDate: '2022',
            endDate: '2024',
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Role A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Role B' })).toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});
