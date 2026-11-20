import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SOCIAL_PLATFORM_KEYS } from '@/lib/profile/socialLinks';

import {
  getPlatformLabelEntry,
  platformLabelMap,
  resolveDisplaySocialLinks,
} from './platformLabelMap';

describe('platformLabelMap & resolveDisplaySocialLinks (#862)', () => {
  it('maps every registered platform key including github with GithubColor SVG (viewBox="0 0 16 16", fill="#181717")', () => {
    expect(Object.keys(platformLabelMap)).toEqual([...SOCIAL_PLATFORM_KEYS]);
    expect(getPlatformLabelEntry('github')?.label).toBe('GitHub');
    expect(getPlatformLabelEntry('  GitHub  ')?.label).toBe('GitHub');
    expect(getPlatformLabelEntry('unknown')).toBeUndefined();

    const { container } = render(platformLabelMap.github.icon);
    const svg = container.querySelector('svg');
    const path = container.querySelector('path');
    expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    expect(path).toHaveAttribute('fill', '#181717');
  });

  it('normalizes, deduplicates (first-seen valid link wins), filters mismatched/unsafe URLs, and sorts display links in canonical 7-platform order (#862 / #945)', () => {
    const resolved = resolveDisplaySocialLinks([
      { platform: 'website', url: 'example.com' },
      { platform: 'website', url: 'https://duplicate-site.example.com' },
      { platform: 'GitHub', url: 'https://gitlab.com/imposter' },
      { platform: 'GitHub', url: 'github.com/octocat' },
      { platform: 'GitHub', url: 'https://github.com/later-duplicate' },
      { platform: 'github', url: 'http://github.com/insecure' },
      { platform: 'facebook', url: 'https://www.facebook.com/octocat' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/octocat' },
      { platform: 'website', url: 'javascript:alert(1)' },
    ]);

    expect(
      resolved.map(({ platform, url, label }) => ({ platform, url, label }))
    ).toEqual([
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/in/octocat',
        label: 'LinkedIn',
      },
      {
        platform: 'facebook',
        url: 'https://www.facebook.com/octocat',
        label: 'Facebook',
      },
      {
        platform: 'github',
        url: 'https://github.com/octocat',
        label: 'GitHub',
      },
      {
        platform: 'website',
        url: 'https://example.com',
        label: '個人網站',
      },
    ]);
  });
});
