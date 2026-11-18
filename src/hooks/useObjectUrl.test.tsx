import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useObjectUrl } from './useObjectUrl';

describe('useObjectUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:test-1');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-1');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  it('returns null when file is undefined and revokes URL on change or unmount', () => {
    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const { result, rerender, unmount } = renderHook(
      ({ file }: { file?: File }) => useObjectUrl(file),
      { initialProps: { file: undefined as File | undefined } }
    );

    expect(result.current).toBeNull();

    rerender({ file: fileA });
    expect(result.current).toBe('blob:test-1');

    rerender({ file: undefined });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(result.current).toBeNull();

    rerender({ file: fileA });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
