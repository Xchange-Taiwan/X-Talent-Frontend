import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultSliderAvatars } from './data';

describe('HomePageSlider static WebP assets (#958)', () => {
  const publicDir = path.resolve(process.cwd(), 'public');

  it('commits all 6 dedicated testimonial_1~6.webp files with valid RIFF/WEBP headers', () => {
    expect(defaultSliderAvatars).toHaveLength(6);

    for (const relativeAvatarUrl of defaultSliderAvatars) {
      const diskPath = path.join(
        publicDir,
        relativeAvatarUrl.replace(/^\//, '')
      );
      expect(fs.existsSync(diskPath)).toBe(true);

      const bytes = fs.readFileSync(diskPath);
      expect(bytes.byteLength).toBeGreaterThan(1024);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    }
  });

  it('retains legacy slider_default_1~6.webp files untouched for compatibility', () => {
    for (let i = 1; i <= 6; i += 1) {
      const legacyPath = path.join(
        publicDir,
        'landing',
        `slider_default_${i}.webp`
      );
      expect(fs.existsSync(legacyPath)).toBe(true);
    }
  });
});
