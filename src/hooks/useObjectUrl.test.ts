import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useObjectUrl } from './useObjectUrl';

describe('useObjectUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL when given a File and revokes it on change and unmount', () => {
    let seq = 0;
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:mock-${++seq}`);
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });

    const { result, rerender, unmount } = renderHook(
      ({ file }: { file: File | null | undefined }) => useObjectUrl(file),
      { initialProps: { file: null as File | null | undefined } }
    );

    expect(result.current).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();

    rerender({ file: fileA });
    expect(result.current).toBe('blob:mock-1');
    expect(revokeSpy).not.toHaveBeenCalled();

    rerender({ file: fileB });
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-1');
    expect(result.current).toBe('blob:mock-2');

    unmount();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-2');
  });
});
