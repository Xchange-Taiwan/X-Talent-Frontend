// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeContext, decodeContext } from './context-io.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('encodeContext / decodeContext', () => {
  it('round-trips a complex object with multi-byte characters', () => {
    const original = {
      title: '修復多語系編碼問題 🎉',
      findings: [
        { file: 'a.mjs', message: '包含中文與 emoji 的訊息 🚀' },
        { file: 'b.mjs', message: 'plain ascii' },
      ],
      nested: { deep: { value: null } },
    };

    const decoded = decodeContext(encodeContext(original));

    expect(decoded).toEqual(original);
  });

  it('round-trips an empty object', () => {
    expect(decodeContext(encodeContext({}))).toEqual({});
  });

  it('returns null for a missing or empty input', () => {
    expect(decodeContext(undefined)).toBeNull();
    expect(decodeContext('')).toBeNull();
  });

  it('returns null and warns instead of throwing on undecodable input', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = decodeContext('not-valid-base64-json!!!');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
