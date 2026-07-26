import { describe, expect, it } from 'vitest';

import { parseOccurrenceId } from './scheduleHelpers';

describe('parseOccurrenceId', () => {
  it('correctly parses valid occurrence IDs with positive integers', () => {
    expect(parseOccurrenceId('101_1774390000')).toEqual({
      id: 101,
      occurrenceUnix: 1774390000,
    });
  });

  it('correctly parses valid occurrence IDs with negative integers (temporary IDs)', () => {
    expect(parseOccurrenceId('-5_1774390000')).toEqual({
      id: -5,
      occurrenceUnix: 1774390000,
    });
  });

  it('returns null for formats missing an underscore separator', () => {
    expect(parseOccurrenceId('1011774390000')).toBeNull();
    expect(parseOccurrenceId('invalid')).toBeNull();
  });

  it('returns null for empty strings or space strings', () => {
    expect(parseOccurrenceId('')).toBeNull();
    expect(parseOccurrenceId(' ')).toBeNull();
  });

  it('returns null if one of the segments is completely missing/empty', () => {
    expect(parseOccurrenceId('101_')).toBeNull();
    expect(parseOccurrenceId('_1774390000')).toBeNull();
    expect(parseOccurrenceId('_')).toBeNull();
    expect(parseOccurrenceId('  _1774390000')).toBeNull();
    expect(parseOccurrenceId('101_  ')).toBeNull();
  });

  it('returns null if either segment is non-numeric', () => {
    expect(parseOccurrenceId('abc_1774390000')).toBeNull();
    expect(parseOccurrenceId('101_xyz')).toBeNull();
    expect(parseOccurrenceId('abc_xyz')).toBeNull();
  });

  it('returns null if either segment contains non-integers (e.g., decimals)', () => {
    expect(parseOccurrenceId('101.5_1774390000')).toBeNull();
    expect(parseOccurrenceId('101_1774390000.5')).toBeNull();
  });

  it('returns null if there are multiple underscore separators', () => {
    expect(parseOccurrenceId('101_1774390000_999')).toBeNull();
  });
});
