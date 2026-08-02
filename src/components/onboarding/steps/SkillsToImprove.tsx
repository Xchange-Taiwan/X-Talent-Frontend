'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { TagCatalogGroupVO } from '@/types/tagCatalog';

import { step4Schema } from './index';
import { TagMultiSelect } from './TagMultiSelect';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step4Schema>>>;
  wantSkillGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const SkillsToImprove: FC<Props> = ({
  form,
  wantSkillGroups,
  maxSelected,
}) => {
  return (
    <TagMultiSelect
      control={form.control}
      name="want_skill"
      groups={wantSkillGroups}
      maxSelected={maxSelected}
    />
  );
};
