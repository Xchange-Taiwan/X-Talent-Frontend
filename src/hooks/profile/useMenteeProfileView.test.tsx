import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import { writeStoredMenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';

import { useMenteeProfileView } from './useMenteeProfileView';

describe('useMenteeProfileView (#960)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const menteeUserA = fromPartial<UserType>({
    user_id: 201,
    name: 'Mentee A',
    avatar: '',
    is_mentor: false,
    want_position: [
      { subject_group: 'frontend_engineer', subject: '前端工程師' },
      { subject_group: 'product_manager', subject: '產品經理' },
    ],
    want_skill: [{ subject_group: 'react', subject: 'React' }],
    want_topic: [{ subject_group: 'career', subject: '職涯規劃' }],
    workExperiences: [],
    educations: [],
    personalLinks: [],
  });

  const menteeUserB = fromPartial<UserType>({
    user_id: 202,
    name: 'Mentee B',
    avatar: 'default_3',
    is_mentor: false,
    want_position: [
      { subject_group: 'uiux_designer', subject: 'UIUX 設計師' },
      { subject_group: 'product_manager', subject: '產品經理' },
    ],
    want_skill: [],
    want_topic: [],
    workExperiences: [],
    educations: [],
    personalLinks: [],
  });

  it('derives activeMenteeDirection synchronously on SSR/initial render before useEffect runs', () => {
    function SsrProbe() {
      const view = useMenteeProfileView({
        userData: menteeUserA,
      });
      return <span data-active={view.activeMenteeDirection ?? 'none'} />;
    }

    const html = renderToStaticMarkup(<SsrProbe />);
    expect(html).toContain('data-active="frontend_engineer"');
  });

  it('hydrates stored direction map from localStorage, switches directions, and resets activeMenteeDirection immediately when switching Mentee profiles', () => {
    writeStoredMenteeDirectionMap(201, {
      frontend_engineer: { skills: [], topics: [] },
      product_manager: { skills: ['react'], topics: ['career'] },
    });

    const { result, rerender } = renderHook(
      ({ userData }: { userData: UserType | null }) =>
        useMenteeProfileView({ userData }),
      { initialProps: { userData: menteeUserA as UserType | null } }
    );

    expect(result.current.activeMenteeDirection).toBe('frontend_engineer');
    expect(result.current.menteeDirectionGroups[1].totalCount).toBe(2);

    act(() => {
      result.current.setActiveMenteeDirection('product_manager');
    });
    expect(result.current.activeMenteeDirection).toBe('product_manager');

    // Switch to Mentee B who ALSO has 'product_manager' as 2nd position; must reset to Mentee B's 1st position ('uiux_designer')
    rerender({ userData: menteeUserB });
    expect(result.current.activeMenteeDirection).toBe('uiux_designer');
  });
});
