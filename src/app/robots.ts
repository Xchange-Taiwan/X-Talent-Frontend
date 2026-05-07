import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/auth/', '/profile/*/edit', '/reservation/', '/api/'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
