'use client';

import type { Control, FieldValues, Path } from 'react-hook-form';

import { TagCatalogGroupVO } from '@/types/tagCatalog';

import { TagMultiSelect } from './TagMultiSelect';

interface TopicsToDiscussFields extends FieldValues {
  want_topic: string[];
}

interface Props<T extends TopicsToDiscussFields> {
  form: { control: Control<T> };
  wantTopicGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const TopicsToDiscuss = <T extends TopicsToDiscussFields>({
  form,
  wantTopicGroups,
  maxSelected,
}: Props<T>) => {
  return (
    <TagMultiSelect
      control={form.control}
      name={'want_topic' as Path<T>}
      groups={wantTopicGroups}
      maxSelected={maxSelected}
    />
  );
};
