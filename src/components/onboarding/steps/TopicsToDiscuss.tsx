'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { TagCatalogGroupVO } from '@/types/tagCatalog';

import { step5Schema } from './index';
import { TagMultiSelect } from './TagMultiSelect';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step5Schema>>>;
  wantTopicGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const TopicsToDiscuss: FC<Props> = ({
  form,
  wantTopicGroups,
  maxSelected,
}) => {
  return (
    <TagMultiSelect
      control={form.control}
      name="want_topic"
      groups={wantTopicGroups}
      maxSelected={maxSelected}
    />
  );
};
