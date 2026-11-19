import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it } from 'vitest';

import { readStoredMenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import type { MentorProfileVO } from '@/types/user';

import { useMenteeDirectionPreference } from './useMenteeDirectionPreference';

describe('useMenteeDirectionPreference (#828)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates from userDto, tracks dirty state when moving tags across directions, and persists on save', () => {
    const dto = fromPartial<MentorProfileVO>({
      user_id: 77,
      want_position: ['frontend_engineer', 'backend_engineer'],
      want_skill: ['react'],
      want_topic: ['interview_skills'],
    });

    const { result } = renderHook(() =>
      useMenteeDirectionPreference('77', dto)
    );

    expect(result.current.isDirectionMapDirty).toBe(false);
    expect(result.current.directionMap.frontend_engineer.skills).toEqual([
      'react',
    ]);

    act(() => {
      result.current.setDirectionMap({
        frontend_engineer: { skills: [], topics: ['interview_skills'] },
        backend_engineer: { skills: ['react'], topics: [] },
      });
    });

    expect(result.current.isDirectionMapDirty).toBe(true);

    act(() => {
      result.current.persistDirectionMap();
    });

    expect(result.current.isDirectionMapDirty).toBe(false);
    expect(readStoredMenteeDirectionMap('77')?.backend_engineer.skills).toEqual(
      ['react']
    );
  });

  it('re-hydrates directionMap when userDto transitions from null (mentor-onboarding) back to Mentee DTO on the same pageUserId (#1336)', () => {
    const dto = fromPartial<MentorProfileVO>({
      user_id: 77,
      want_position: ['frontend_engineer'],
      want_skill: ['react'],
      want_topic: ['career_planning'],
    });

    const { result, rerender } = renderHook(
      ({ currentDto }: { currentDto: MentorProfileVO | null }) =>
        useMenteeDirectionPreference('77', currentDto),
      { initialProps: { currentDto: dto as MentorProfileVO | null } }
    );

    expect(result.current.directionMap.frontend_engineer?.skills).toEqual([
      'react',
    ]);

    rerender({ currentDto: null });
    rerender({
      currentDto: fromPartial<MentorProfileVO>({
        user_id: 77,
        want_position: ['product_manager', 'frontend_engineer'],
        want_skill: ['react', 'product_strategy'],
        want_topic: ['career_planning'],
      }),
    });

    expect(Object.keys(result.current.directionMap)).toEqual([
      'product_manager',
    ]);
  });
});
