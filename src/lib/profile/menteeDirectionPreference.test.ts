import { describe, expect, it } from 'vitest';

import {
  computeDirectionSelectLimit,
  flattenDirectionBucket,
  hydrateMenteeDirectionMap,
  readStoredMenteeDirectionMap,
  syncMenteePositions,
  updateDirectionBucket,
  writeStoredMenteeDirectionMap,
} from './menteeDirectionPreference';

describe('menteeDirectionPreference (#828 / #959)', () => {
  it('hydrates legacy flat skills and topics onto the first selected position when no stored map exists', () => {
    const map = hydrateMenteeDirectionMap({
      positions: ['frontend_engineer', 'backend_engineer'],
      flatSkills: ['react', 'typescript'],
      flatTopics: ['interview_skills'],
      storedMap: null,
    });

    expect(map).toEqual({
      frontend_engineer: {
        skills: ['react', 'typescript'],
        topics: ['interview_skills'],
      },
      backend_engineer: {
        skills: [],
        topics: [],
      },
    });
  });

  it('reconciles a stored per-direction map against authoritative backend positions, skills, and topics without losing newly added backend items', () => {
    const map = hydrateMenteeDirectionMap({
      positions: ['frontend_engineer', 'backend_engineer'],
      flatSkills: ['react', 'go', 'docker'],
      flatTopics: ['portfolio_guidance', 'career_transition'],
      storedMap: {
        frontend_engineer: {
          skills: ['react', 'stale_removed_skill'],
          topics: ['portfolio_guidance'],
        },
        backend_engineer: {
          skills: ['go'],
          topics: [],
        },
        unselected_old_position: {
          skills: ['docker'],
          topics: ['career_transition'],
        },
      },
    });

    expect(map).toEqual({
      frontend_engineer: {
        skills: ['react', 'docker'],
        topics: ['portfolio_guidance', 'career_transition'],
      },
      backend_engineer: {
        skills: ['go'],
        topics: [],
      },
    });
    expect(
      flattenDirectionBucket(
        map,
        ['frontend_engineer', 'backend_engineer'],
        'skills'
      )
    ).toEqual(['react', 'docker', 'go']);
  });

  it('preserves each direction independently when switching tabs and updating skills or topics', () => {
    const initial = hydrateMenteeDirectionMap({
      positions: ['frontend_engineer', 'backend_engineer'],
      flatSkills: [],
      flatTopics: [],
      storedMap: null,
    });

    const step1 = updateDirectionBucket(
      initial,
      ['frontend_engineer', 'backend_engineer'],
      'frontend_engineer',
      'skills',
      ['react', 'typescript']
    );

    const step2 = updateDirectionBucket(
      step1.directionMap,
      ['frontend_engineer', 'backend_engineer'],
      'backend_engineer',
      'skills',
      ['go', 'python']
    );

    expect(step2.directionMap.frontend_engineer.skills).toEqual([
      'react',
      'typescript',
    ]);
    expect(step2.directionMap.backend_engineer.skills).toEqual([
      'go',
      'python',
    ]);
    expect(step2.flatItems).toEqual(['react', 'typescript', 'go', 'python']);
  });

  it('clears the unchecked direction skills and topics immediately when a position is deselected', () => {
    const map = {
      frontend_engineer: {
        skills: ['react', 'typescript'],
        topics: ['portfolio_guidance'],
      },
      backend_engineer: {
        skills: ['go', 'typescript'],
        topics: ['career_transition'],
      },
    };

    const synced = syncMenteePositions(map, ['backend_engineer']);

    expect(synced.directionMap).toEqual({
      backend_engineer: {
        skills: ['go', 'typescript'],
        topics: ['career_transition'],
      },
    });
    expect(synced.flatSkills).toEqual(['go', 'typescript']);
    expect(synced.flatTopics).toEqual(['career_transition']);
  });

  it('caps cross-direction unique items at 10 while allowing shared items across directions', () => {
    const map = {
      dir_a: {
        skills: ['s1', 's2', 's3', 's4', 's5', 's6'],
        topics: [],
      },
      dir_b: {
        skills: ['s6', 's7', 's8', 's9'],
        topics: [],
      },
    };
    // Unique skills across dir_a + dir_b = 9 (s1..s9). Remaining unique budget = 1.
    // dir_b currently has 4 items -> can select 4 + 1 = 5 items max before hitting 10 unique!
    expect(
      computeDirectionSelectLimit(
        map,
        ['dir_a', 'dir_b'],
        'dir_b',
        'skills',
        10
      )
    ).toBe(5);

    const atCap = updateDirectionBucket(
      map,
      ['dir_a', 'dir_b'],
      'dir_b',
      'skills',
      ['s6', 's7', 's8', 's9', 's10', 's11'],
      10
    );
    expect(atCap.flatItems).toHaveLength(10);
    expect(atCap.flatItems).toContain('s10');
    expect(atCap.flatItems).not.toContain('s11');
  });

  it('persists and reads per-user direction maps safely via storage adapter', () => {
    const mem: Record<string, string> = {};
    const readRaw = (k: string) => mem[k] ?? null;
    const writeRaw = (k: string, v: string) => {
      mem[k] = v;
    };
    const sample = {
      frontend_engineer: {
        skills: ['react'],
        topics: ['interview_skills'],
      },
    };
    writeStoredMenteeDirectionMap(42, sample, writeRaw);
    expect(readStoredMenteeDirectionMap(42, readRaw)).toEqual(sample);
    expect(readStoredMenteeDirectionMap(999, readRaw)).toBeNull();
  });
});
