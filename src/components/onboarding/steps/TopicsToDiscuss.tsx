'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import { step5Schema } from './index';
import { TagMultiSelect } from './TagMultiSelect';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step5Schema>>>;
  wantTopicGroups: TagCatalogGroupVO[];
}

export const TopicsToDiscuss: FC<Props> = ({ form, wantTopicGroups }) => {
  return (
    <TagMultiSelect
      control={form.control}
      name="want_topic"
      groups={wantTopicGroups}
    />
  );
};
