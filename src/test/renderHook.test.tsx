import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

describe('renderHook setup', () => {
  it('should render a hook and track state updates with act', () => {
    const { result } = renderHook(() => useState(0));

    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1](1);
    });

    expect(result.current[0]).toBe(1);
  });
});
