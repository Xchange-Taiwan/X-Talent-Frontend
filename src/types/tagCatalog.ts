import type { components } from '@/types/api';

export type TagCatalogsVO = components['schemas']['TagCatalogsVO'];
export type TagCatalogVO = components['schemas']['TagCatalogVO'];
export type TagCatalogGroupVO = components['schemas']['TagCatalogGroupVO'];
export type TagCatalogLeafVO = components['schemas']['TagCatalogLeafVO'];

export type TagBucketKey =
  'want_position' | 'want_skill' | 'want_topic' | 'have_skill' | 'have_topic';

export interface IndustryOption {
  subject_group: string;
  subject: string;
}

export type TagBuckets = Record<TagBucketKey, TagCatalogGroupVO[]>;

export interface TagCatalogsByBucket extends TagBuckets {
  industry: IndustryOption[];
}

export const TAG_BUCKET_KEYS: readonly TagBucketKey[] = [
  'want_position',
  'want_skill',
  'want_topic',
  'have_skill',
  'have_topic',
];
