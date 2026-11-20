import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import type { Session } from 'next-auth';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { hasProfileDtoConverged } from '@/lib/profile/convergence';
import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import { defaultValues, type ProfileFormValues } from '@/schemas/profileSchema';
import { mockSession, mockUserDTO } from '@/test/fixtures/profile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { planProfileMutation } from './planProfileMutation';

const INDUSTRY_CATALOG: IndustryOption[] = [
  { subject_group: 'tech', subject: '軟體與科技' },
  { subject_group: 'finance', subject: '金融與銀行' },
];

describe('planProfileMutation (single-pass pure mutation planner #943)', () => {
  it('plans mentee-onboarding as pure mentee (is_mentor: false, onboarding: true, zero mentor wire keys) and normalizes preset avatar codes', () => {
    const menteeSession: Session = {
      ...mockSession,
      user: {
        id: '42',
        name: 'OAuth Name',
        email: 'mentee@example.com',
        isMentor: false,
        onBoarding: false,
        avatar: undefined,
        avatarUpdatedAt: 1700000000000,
      },
    };

    const plan = planProfileMutation(
      {
        mode: 'mentee-onboarding',
        values: {
          name: 'Mentee Lin',
          avatar: '/avatars/default_4.webp',
          avatarFile: undefined,
          language: 'zh_TW',
          location: 'TWN',
          years_of_experience: '1_3',
          industry: 'finance',
          want_position: ['product_manager'],
          want_skill: ['product_strategy'],
          want_topic: ['career'],
        },
      },
      {
        session: menteeSession,
        industryCatalog: INDUSTRY_CATALOG,
        now: () => 1755000000000,
      }
    );

    expect(plan.shouldWriteProfile).toBe(true);
    expect(plan.experiencesDirty).toBe(false);
    expect(plan.resolvedPageUserId).toBe('42');
    expect(plan.resolvedUserId).toBe(42);

    // Exact 12-key mentee wire payload with zero mentor branches
    expect(plan.wirePayload).toEqual({
      name: 'Mentee Lin',
      avatar: 'default_4',
      location: 'TWN',
      years_of_experience: '1_3',
      industry: 'finance',
      language: 'zh_TW',
      is_mentor: false,
      onboarding: true,
      about: '',
      personal_statement: '',
      want_position: ['product_manager'],
      want_skill: ['product_strategy'],
      want_topic: ['career'],
    });
    expect(plan.wirePayload).not.toHaveProperty('job_title');
    expect(plan.wirePayload).not.toHaveProperty('company');
    expect(plan.wirePayload).not.toHaveProperty('experiences');
    expect(plan.wirePayload).not.toHaveProperty('have_skill');
    expect(plan.wirePayload).not.toHaveProperty('have_topic');

    expect(plan.identitySnapshot).toEqual({
      name: 'Mentee Lin',
      avatar: 'default_4',
      avatarUpdatedAt: 1755000000000,
      isMentor: false,
      onBoarding: true,
      jobTitle: undefined,
      company: undefined,
      personalLinks: [],
    });

    expect(plan.optimisticDto).toMatchObject({
      user_id: 42,
      name: 'Mentee Lin',
      avatar: 'default_4',
      is_mentor: false,
      onboarding: true,
      industry: { subject_group: 'finance', subject: '金融與銀行' },
      want_position: ['product_manager'],
      want_skill: ['product_strategy'],
      want_topic: ['career'],
      experiences: [],
    });

    expect(plan.expectedRecordDto).toMatchObject({
      name: 'Mentee Lin',
      avatar: 'default_4',
      is_mentor: false,
      onboarding: true,
      job_title: undefined,
      company: undefined,
      experiences: undefined,
    });
  });

  it('mirrors is_primary work experience to job_title/company, normalizes personal links, and preserves opposite-role preferences in a single pass', () => {
    const currentDto = fromPartial<MentorProfileVO>({
      ...mockUserDTO,
      user_id: 7,
      is_mentor: true,
      onboarding: true,
      personal_statement: 'Legacy Statement',
      want_position: ['uiux'],
      want_skill: ['figma'],
      want_topic: ['portfolio'],
    });

    const values: ProfileFormValues = {
      ...defaultValues,
      is_mentor: true,
      name: 'Mentor Wang',
      avatar: 'https://example.com/avatar.jpg',
      location: 'TWN',
      years_of_experience: '5_10',
      industry: 'tech',
      about: 'Staff architect',
      statement: undefined,
      have_skill: ['typescript', 'system_design'],
      have_topic: ['architecture'],
      want_position: [],
      want_skill: [],
      want_topic: [],
      work_experiences: [
        {
          id: 0,
          job: 'Frontend Engineer',
          company: 'Startup',
          job_period_start: '2018',
          job_period_end: '2021',
          industry: 'tech',
          job_location: 'TWN',
          description: 'UI',
          is_primary: false,
        },
        {
          id: 1,
          job: 'Principal Engineer',
          company: 'XChange',
          job_period_start: '2021',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'Core platform',
          is_primary: true,
        },
      ],
      educations: [
        {
          id: 0,
          school: '國立臺灣大學',
          subject: '資訊工程學系',
          education_period_start: '2014',
          education_period_end: '2018',
        },
      ],
      links: {
        ...defaultValues.links,
        github: 'github.com/mentorwang',
        twitter: 'https://evil-domain.com/spoof',
      },
    };

    const uploadedAvatarUrl =
      'https://s3.amazonaws.com/bucket/files/7/avatar?v=999';

    const plan = planProfileMutation(
      {
        mode: 'edit',
        values,
        dirtyFields: {
          work_experiences: [{ job: true }],
          links: { github: true },
        },
        currentDto,
      },
      {
        pageUserId: '7',
        session: {
          ...mockSession,
          user: { ...mockSession.user!, id: '7' },
        },
        industryCatalog: INDUSTRY_CATALOG,
        uploadedAvatarUrl,
        now: () => 1756000000000,
      }
    );

    expect(plan.shouldWriteProfile).toBe(true);
    expect(plan.experiencesDirty).toBe(true);
    expect(plan.wirePayload).toMatchObject({
      name: 'Mentor Wang',
      avatar: uploadedAvatarUrl,
      job_title: 'Principal Engineer',
      company: 'XChange',
      personal_statement: 'Legacy Statement',
      want_position: ['uiux'],
      want_skill: ['figma'],
      want_topic: ['portfolio'],
      have_skill: ['typescript', 'system_design'],
      have_topic: ['architecture'],
    });
    expect(plan.wirePayload.experiences).toHaveLength(3);
    expect(plan.wirePayload).not.toHaveProperty('work_experiences');
    expect(plan.wirePayload).not.toHaveProperty('educations');
    expect(plan.wirePayload).not.toHaveProperty('links');
    expect(plan.wirePayload).not.toHaveProperty('statement');
    expect(plan.wirePayload).not.toHaveProperty('avatarFile');

    expect(plan.identitySnapshot).toEqual({
      name: 'Mentor Wang',
      avatar: uploadedAvatarUrl,
      avatarUpdatedAt: 1756000000000,
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Principal Engineer',
      company: 'XChange',
      personalLinks: [
        { platform: 'github', url: 'https://github.com/mentorwang' },
      ],
    });

    expect(plan.optimisticDto.job_title).toBe('Principal Engineer');
    expect(plan.optimisticDto.company).toBe('XChange');
    expect(plan.cardFields).toEqual({
      name: 'Mentor Wang',
      jobTitle: 'Principal Engineer',
      company: 'XChange',
      about: 'Staff architect',
      yearsOfExperience: '5_10',
      haveTopic: ['architecture'],
      haveSkill: ['typescript', 'system_design'],
      avatar: uploadedAvatarUrl,
    });
  });

  it('enforces unified expectedRecordDto sentinel semantics: undefined = unconstrained, null = explicitly cleared', () => {
    const { experiences: existingExperiences } = encode({
      workExperiences: [
        {
          job: 'Existing Role',
          company: 'Existing Co',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
      educations: [],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/existing' },
      ],
    });

    const currentDto = fromPartial<MentorProfileVO>({
      ...mockUserDTO,
      user_id: 1,
      avatar: 'https://example.com/old.png',
      job_title: 'Existing Role',
      company: 'Existing Co',
      about: 'Old about',
      personal_statement: 'Old statement',
      location: 'TWN',
      years_of_experience: '3_5',
      industry: { subject_group: 'tech', subject: '軟體與科技' },
      experiences: toWireExperiences(existingExperiences),
    });

    // Case 1: Edit mode clearing scalar + avatar fields while leaving experiences untouched
    const editPlan = planProfileMutation(
      {
        mode: 'edit',
        values: {
          ...defaultValues,
          name: 'Updated Name',
          avatar: '',
          about: '',
          statement: '',
          location: '',
          years_of_experience: '',
          industry: '',
        },
        dirtyFields: {
          name: true,
          avatar: true,
          about: true,
          statement: true,
          location: true,
          years_of_experience: true,
          industry: true,
        },
        currentDto,
      },
      {
        pageUserId: '1',
        session: mockSession,
      }
    );

    // Unconstrained fields MUST strictly be `undefined` (never `null`)
    expect(editPlan.expectedRecordDto.is_mentor).toBeUndefined();
    expect(editPlan.expectedRecordDto.onboarding).toBeUndefined();
    expect(editPlan.expectedRecordDto.job_title).toBeUndefined();
    expect(editPlan.expectedRecordDto.company).toBeUndefined();
    expect(editPlan.expectedRecordDto.experiences).toBeUndefined();

    // Explicitly cleared fields MUST strictly be `null`
    expect(editPlan.expectedRecordDto.avatar).toBeNull();
    expect(editPlan.expectedRecordDto.about).toBeNull();
    expect(editPlan.expectedRecordDto.personal_statement).toBeNull();
    expect(editPlan.expectedRecordDto.location).toBeNull();
    expect(editPlan.expectedRecordDto.years_of_experience).toBeNull();
    expect(editPlan.expectedRecordDto.industry).toBeNull();

    // Verify convergence accepts backend role differences on edit (unconstrained is_mentor)
    // while rejecting stale uncleared avatar/scalars
    const backendWithRoleFlipButStaleAvatar = fromPartial<MentorProfileVO>({
      ...currentDto,
      name: 'Updated Name',
      is_mentor: false,
      avatar: 'https://example.com/old.png',
      about: null,
      personal_statement: null,
      location: null,
      years_of_experience: null,
      industry: null,
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: [],
      have_topic: [],
    });
    expect(
      hasProfileDtoConverged(
        editPlan.expectedRecordDto,
        backendWithRoleFlipButStaleAvatar
      )
    ).toBe(false);

    const backendConvergedWithRoleFlip = fromPartial<MentorProfileVO>({
      ...backendWithRoleFlipButStaleAvatar,
      avatar: null,
    });
    expect(
      hasProfileDtoConverged(
        editPlan.expectedRecordDto,
        backendConvergedWithRoleFlip
      )
    ).toBe(true);

    // Case 2: Clean no-op edit (dirtyFields: {}) sets shouldWriteProfile = false
    const noopPlan = planProfileMutation(
      {
        mode: 'edit',
        values: { ...defaultValues, name: 'Same Name', avatar: '' },
        dirtyFields: {},
        currentDto,
      },
      { pageUserId: '1', session: mockSession }
    );
    expect(noopPlan.shouldWriteProfile).toBe(false);
    expect(noopPlan.wirePayload.experiences).toBeUndefined();

    // Case 3: mentor-onboarding forces shouldWriteProfile = true and constrains is_mentor/onboarding
    const mentorOnboardingPlan = planProfileMutation(
      {
        mode: 'mentor-onboarding',
        values: { ...defaultValues, name: 'New Mentor' },
        dirtyFields: {},
        currentDto,
      },
      { pageUserId: '1', session: mockSession }
    );
    expect(mentorOnboardingPlan.shouldWriteProfile).toBe(true);
    expect(mentorOnboardingPlan.expectedRecordDto.is_mentor).toBe(true);
    expect(mentorOnboardingPlan.expectedRecordDto.onboarding).toBe(true);
  });

  it('aligns wirePayload, identitySnapshot, optimisticDto, and expectedRecordDto 100% when dirtyFields is undefined and fields are cleared while preserving omitted statement', () => {
    const { experiences: populatedExperiences } = encode({
      workExperiences: [
        {
          job: 'Principal Architect',
          company: 'Legacy Corp',
          job_period_start: '2019',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'Architecture',
          is_primary: true,
        },
      ],
      educations: [
        {
          school: '國立臺灣大學',
          subject: '資訊工程學系',
          education_period_start: '2015',
          education_period_end: '2019',
        },
      ],
      personalLinks: [
        { platform: 'github', url: 'https://github.com/legacy-user' },
      ],
    });

    const populatedDto = fromPartial<MentorProfileVO>({
      ...mockUserDTO,
      user_id: 1,
      name: 'Legacy Name',
      avatar: 'https://s3.amazonaws.com/bucket/files/1/avatar?v=100',
      job_title: 'Principal Architect',
      company: 'Legacy Corp',
      about: 'Populated bio',
      personal_statement: 'Preserved legacy statement',
      location: 'TWN',
      years_of_experience: '5_10',
      industry: { subject_group: 'tech', subject: '軟體與科技' },
      experiences: toWireExperiences(populatedExperiences),
      have_skill: ['system_design'],
      have_topic: ['architecture'],
      want_position: ['staff_engineer'],
      want_skill: ['leadership'],
      want_topic: ['career'],
    });

    const populatedSession: Session = {
      ...mockSession,
      user: {
        ...mockSession.user!,
        id: '1',
        name: 'Legacy Name',
        avatar: 'https://s3.amazonaws.com/bucket/files/1/avatar?v=100',
        avatarUpdatedAt: 1700000000000,
        jobTitle: 'Session Architect',
        company: 'Session Corp',
        personalLinks: [
          { platform: 'linkedin', url: 'https://linkedin.com/in/session-user' },
        ],
      },
    };

    // Subcase A: dirtyFields is undefined, fields are cleared (`''` / `[]`), and `statement: undefined` is omitted
    const planWithOmittedStatement = planProfileMutation(
      {
        mode: 'edit',
        values: {
          ...defaultValues,
          is_mentor: true,
          name: 'Cleared Mentor',
          avatar: '',
          avatarFile: undefined,
          about: '',
          location: '',
          years_of_experience: '',
          industry: '',
          statement: undefined,
          work_experiences: [],
          educations: [],
          have_skill: [],
          have_topic: [],
          want_position: [],
          want_skill: [],
          want_topic: [],
        },
        dirtyFields: undefined,
        currentDto: populatedDto,
      },
      {
        pageUserId: '1',
        session: populatedSession,
        industryCatalog: INDUSTRY_CATALOG,
        now: () => 1760000000000,
      }
    );

    expect(planWithOmittedStatement.shouldWriteProfile).toBe(true);
    expect(planWithOmittedStatement.experiencesDirty).toBe(true);
    expect(planWithOmittedStatement.wirePayload).toMatchObject({
      name: 'Cleared Mentor',
      avatar: '',
      about: '',
      location: '',
      years_of_experience: '',
      industry: '',
      job_title: '',
      company: '',
      personal_statement: 'Preserved legacy statement',
    });

    expect(planWithOmittedStatement.identitySnapshot).toEqual({
      name: 'Cleared Mentor',
      avatar: null,
      avatarUpdatedAt: 1760000000000,
      isMentor: true,
      onBoarding: true,
      jobTitle: undefined,
      company: undefined,
      personalLinks: [],
    });

    expect(planWithOmittedStatement.optimisticDto).toMatchObject({
      name: 'Cleared Mentor',
      avatar: null,
      job_title: null,
      company: null,
      about: null,
      location: null,
      years_of_experience: null,
      industry: null,
      personal_statement: 'Preserved legacy statement',
    });

    expect(planWithOmittedStatement.expectedRecordDto).toMatchObject({
      name: 'Cleared Mentor',
      avatar: null,
      job_title: null,
      company: null,
      about: null,
      location: null,
      years_of_experience: null,
      industry: null,
      personal_statement: 'Preserved legacy statement',
    });

    // Stale pre-write DTO must NOT falsely converge
    expect(
      hasProfileDtoConverged(
        planWithOmittedStatement.expectedRecordDto,
        populatedDto
      )
    ).toBe(false);

    // Backend DTO reflecting `wirePayload` converges immediately on first poll!
    const postWriteBackendDto = fromPartial<MentorProfileVO>({
      ...populatedDto,
      name: 'Cleared Mentor',
      avatar: null,
      job_title: '',
      company: '',
      about: '',
      location: '',
      years_of_experience: '',
      industry: null,
      personal_statement: 'Preserved legacy statement',
      experiences: [],
      have_skill: [],
      have_topic: [],
    });
    expect(
      hasProfileDtoConverged(
        planWithOmittedStatement.expectedRecordDto,
        postWriteBackendDto
      )
    ).toBe(true);

    // Subcase B: dirtyFields is undefined and `statement: ''` is explicitly cleared (and no prior avatar exists)
    const planWithClearedStatementNoPriorAvatar = planProfileMutation(
      {
        mode: 'edit',
        values: {
          ...defaultValues,
          is_mentor: true,
          name: 'Cleared Statement Mentor',
          avatar: '',
          statement: '',
        },
        dirtyFields: undefined,
        currentDto: { ...populatedDto, avatar: null },
      },
      {
        pageUserId: '1',
        session: {
          ...populatedSession,
          user: { ...populatedSession.user!, avatar: undefined },
        },
        now: () => 1760000000000,
      }
    );

    expect(
      planWithClearedStatementNoPriorAvatar.wirePayload.personal_statement
    ).toBe('');
    expect(
      planWithClearedStatementNoPriorAvatar.optimisticDto.personal_statement
    ).toBeNull();
    expect(
      planWithClearedStatementNoPriorAvatar.expectedRecordDto.personal_statement
    ).toBeNull();
    expect(
      planWithClearedStatementNoPriorAvatar.expectedRecordDto.avatar
    ).toBeUndefined();
    expect(
      planWithClearedStatementNoPriorAvatar.identitySnapshot.avatarUpdatedAt
    ).toBe(1700000000000);
  });

  it('contains zero React, Next.js, next-auth/react, hook, component, store, or app imports', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'planProfileMutation.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/from\s+['"]next\//);
    expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
    expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
    expect(source).not.toMatch(/from\s+['"]@\/components\//);
    expect(source).not.toMatch(/from\s+['"]@\/stores\//);
    expect(source).not.toMatch(/from\s+['"]@\/app\//);
  });
});
