import { NextResponse } from 'next/server';

import {
  fetchTagCatalogServer,
  isOnboardingCatalogComplete,
} from '@/services/profile/tagCatalog.server';

const SAFE_LANGUAGE_RE = /^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})?$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ language: string }> }
) {
  const { language } = await context.params;
  const trimmed = typeof language === 'string' ? language.trim() : '';

  if (!SAFE_LANGUAGE_RE.test(trimmed)) {
    return NextResponse.json(
      { error: 'Invalid language parameter' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const catalog = await fetchTagCatalogServer(trimmed);
  if (!isOnboardingCatalogComplete(catalog)) {
    return NextResponse.json(catalog, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json(catalog, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
