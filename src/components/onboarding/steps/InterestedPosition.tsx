'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import { step3Schema } from './index';
import { TagMultiSelect } from './TagMultiSelect';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step3Schema>>>;
  wantPositionGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export const InterestedPosition: FC<Props> = ({
  form,
  wantPositionGroups,
  maxSelected,
}) => {
  return (
    <TagMultiSelect
      control={form.control}
      name="want_position"
      groups={wantPositionGroups}
      maxSelected={maxSelected}
    />
  );
};
