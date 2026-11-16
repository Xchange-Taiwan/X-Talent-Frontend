'use client';

import type { Control, FieldValues, Path } from 'react-hook-form';

import { TagCatalogGroupVO } from '@/types/tagCatalog';

import { TagMultiSelect } from './TagMultiSelect';

interface SkillsToImproveFields extends FieldValues {
  want_skill: string[];
}

interface Props<T extends SkillsToImproveFields> {
  form: { control: Control<T> };
  wantSkillGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const SkillsToImprove = <T extends SkillsToImproveFields>({
  form,
  wantSkillGroups,
  maxSelected,
}: Props<T>) => {
  return (
    <TagMultiSelect
      control={form.control}
      name={'want_skill' as Path<T>}
      groups={wantSkillGroups}
      maxSelected={maxSelected}
    />
  );
};
