'use client';

import type { Control, FieldValues, Path } from 'react-hook-form';

import { TagCatalogGroupVO } from '@/types/tagCatalog';

import { TagMultiSelect } from './TagMultiSelect';

interface InterestedPositionFields extends FieldValues {
  want_position: string[];
}

interface Props<T extends InterestedPositionFields> {
  form: { control: Control<T> };
  wantPositionGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const InterestedPosition = <T extends InterestedPositionFields>({
  form,
  wantPositionGroups,
  maxSelected,
}: Props<T>) => {
  return (
    <TagMultiSelect
      control={form.control}
      name={'want_position' as Path<T>}
      groups={wantPositionGroups}
      maxSelected={maxSelected}
    />
  );
};
