'use client';

import React, { useMemo, useState } from 'react';
import { useFormState, useWatch } from 'react-hook-form';

import type { Category } from '@/components/ui/category-multi-select';
import { CompactCategoryPicker } from '@/components/ui/compact-category-picker';
import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  computeDirectionSelectLimit,
  type MenteeDirectionMap,
  syncMenteePositions,
  updateDirectionBucket,
} from '@/lib/profile/menteeDirectionPreference';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { Section } from './Section';

export interface MenteeDirectionPreferenceSectionProps {
  form: ProfileFormContext;
  wantPositionCategories: Category[];
  wantSkillCategories: Category[];
  wantTopicCategories: Category[];
  directionMap: MenteeDirectionMap;
  onDirectionMapChange: (next: MenteeDirectionMap) => void;
}

function buildOptionLabelMap(categories: Category[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of categories) {
    for (const opt of cat.options) {
      map.set(opt.value, opt.label);
    }
  }
  return map;
}

export const MenteeDirectionPreferenceSection = React.memo(
  function MenteeDirectionPreferenceSection({
    form,
    wantPositionCategories,
    wantSkillCategories,
    wantTopicCategories,
    directionMap,
    onDirectionMapChange,
  }: MenteeDirectionPreferenceSectionProps) {
    const watchedPositions = useWatch({
      control: form.control,
      name: 'want_position',
    });
    const watchedSkills = useWatch({
      control: form.control,
      name: 'want_skill',
    });
    const watchedTopics = useWatch({
      control: form.control,
      name: 'want_topic',
    });

    const selectedPositions = useMemo(
      () => (Array.isArray(watchedPositions) ? watchedPositions : []),
      [watchedPositions]
    );
    const totalUniqueSkills = Array.isArray(watchedSkills)
      ? watchedSkills.length
      : 0;
    const totalUniqueTopics = Array.isArray(watchedTopics)
      ? watchedTopics.length
      : 0;

    const [activeDirectionState, setActiveDirectionState] = useState<string>(
      () => selectedPositions[0] ?? ''
    );

    const resolvedActiveDirection = useMemo(() => {
      if (
        activeDirectionState &&
        selectedPositions.includes(activeDirectionState)
      ) {
        return activeDirectionState;
      }
      return selectedPositions[0] ?? '';
    }, [activeDirectionState, selectedPositions]);

    const positionLabelMap = useMemo(
      () => buildOptionLabelMap(wantPositionCategories),
      [wantPositionCategories]
    );

    const { errors, isSubmitted } = useFormState({
      control: form.control,
    });

    const handlePositionsChange = (rawNextPositions: string[]) => {
      const nextPositions = rawNextPositions.slice(-1);
      const synced = syncMenteePositions(directionMap, nextPositions, 10);
      onDirectionMapChange(synced.directionMap);
      form.setValue('want_position', nextPositions, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      form.setValue('want_skill', synced.flatSkills, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      form.setValue('want_topic', synced.flatTopics, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      if (nextPositions.length === 0) {
        form.clearErrors(['want_position', 'want_skill', 'want_topic']);
      }

      if (
        nextPositions.length > 0 &&
        !nextPositions.includes(resolvedActiveDirection)
      ) {
        setActiveDirectionState(nextPositions[0]);
      }
    };

    const handleDirectionSkillsChange = (nextSkills: string[]) => {
      if (!resolvedActiveDirection) return;
      const updated = updateDirectionBucket(
        directionMap,
        selectedPositions,
        resolvedActiveDirection,
        'skills',
        nextSkills,
        10
      );
      onDirectionMapChange(updated.directionMap);
      form.setValue('want_skill', updated.flatItems, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      if (updated.flatItems.length > 0) {
        form.clearErrors('want_skill');
      }
    };

    const handleDirectionTopicsChange = (nextTopics: string[]) => {
      if (!resolvedActiveDirection) return;
      const updated = updateDirectionBucket(
        directionMap,
        selectedPositions,
        resolvedActiveDirection,
        'topics',
        nextTopics,
        10
      );
      onDirectionMapChange(updated.directionMap);
      form.setValue('want_topic', updated.flatItems, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      if (updated.flatItems.length > 0) {
        form.clearErrors(['want_skill', 'want_topic']);
      }
    };

    const activeSkills = resolvedActiveDirection
      ? (directionMap[resolvedActiveDirection]?.skills ?? [])
      : [];
    const activeTopics = resolvedActiveDirection
      ? (directionMap[resolvedActiveDirection]?.topics ?? [])
      : [];

    const skillMaxForActive = resolvedActiveDirection
      ? computeDirectionSelectLimit(
          directionMap,
          selectedPositions,
          resolvedActiveDirection,
          'skills',
          10
        )
      : 10;

    const topicMaxForActive = resolvedActiveDirection
      ? computeDirectionSelectLimit(
          directionMap,
          selectedPositions,
          resolvedActiveDirection,
          'topics',
          10
        )
      : 10;

    const positionError =
      errors.want_position?.message ?? errors.want_position?.root?.message;
    const skillError =
      errors.want_skill?.message ?? errors.want_skill?.root?.message;
    const topicError =
      errors.want_topic?.message ?? errors.want_topic?.root?.message;

    return (
      <div className="space-y-7">
        <Section
          id="want_position"
          dataTestId="mentee-section-preferences"
          variant="option-a"
          title="有興趣多了解的職位"
        >
          <div className="space-y-2">
            <CompactCategoryPicker
              categories={wantPositionCategories}
              value={selectedPositions}
              onChange={handlePositionsChange}
              maxSelected={1}
              singleSelect
              addLabel="新增職位"
              searchPlaceholder="搜尋職位"
              countText={`已選 ${selectedPositions.length} / 1`}
            />
            {positionError && (
              <p className="text-status-error-default text-sm font-medium">
                {String(positionError)}
              </p>
            )}
          </div>
        </Section>

        <div
          id="want_skill"
          data-testid="mentee-direction-panel"
          className="space-y-6"
        >
          {selectedPositions.length === 0 ? (
            skillError || topicError ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
                <div className="hidden lg:block lg:w-48 lg:shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  {skillError && (
                    <p className="text-status-error-default text-sm font-medium">
                      {String(skillError)}
                    </p>
                  )}
                  {topicError && (
                    <p
                      id="want_topic"
                      className="text-status-error-default text-sm font-medium"
                    >
                      {String(topicError)}
                    </p>
                  )}
                </div>
              </div>
            ) : null
          ) : (
            <>
              <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
                <div className="hidden lg:block lg:w-48 lg:shrink-0" />
                <div
                  role="tablist"
                  aria-label="職位方向"
                  className="border-background-border flex min-w-0 flex-1 flex-wrap items-center gap-6 border-b"
                >
                  {selectedPositions.map((posCode) => {
                    const isSelected = posCode === resolvedActiveDirection;
                    const label = positionLabelMap.get(posCode) ?? posCode;
                    const bucket = directionMap[posCode];
                    const dirCount =
                      (bucket?.skills.length ?? 0) +
                      (bucket?.topics.length ?? 0);
                    return (
                      <button
                        key={posCode}
                        type="button"
                        role="tab"
                        aria-label={label}
                        aria-selected={isSelected}
                        onClick={() => setActiveDirectionState(posCode)}
                        className={cn(
                          '-mb-px inline-flex cursor-pointer items-baseline gap-1.5 border-b-2 px-1 pt-1 pb-2.5 text-sm transition-colors',
                          isSelected
                            ? 'border-brand-700 text-brand-700 font-semibold'
                            : 'text-text-secondary hover:text-text-primary border-transparent font-medium',
                          FOCUS_RING_NO_OFFSET_CLASSES
                        )}
                      >
                        <span>{label}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'text-xs tabular-nums',
                            isSelected ? 'text-brand-700' : 'text-text-tertiary'
                          )}
                        >
                          {dirCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
                <div className="lg:w-48 lg:shrink-0">
                  <p className="text-text-primary text-sm font-bold">
                    想加強的技能
                  </p>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <CompactCategoryPicker
                    key={`skill-${resolvedActiveDirection}`}
                    categories={wantSkillCategories}
                    value={activeSkills}
                    onChange={handleDirectionSkillsChange}
                    maxSelected={skillMaxForActive}
                    addLabel="新增技能"
                    searchPlaceholder="搜尋技能"
                    countText={`已選 ${totalUniqueSkills} / 10`}
                    limitHelperText={(selected) =>
                      totalUniqueSkills >= 10
                        ? `此方向已選 ${selected} 項（全方向共 ${totalUniqueSkills} / 10 — 取消其他項目以繼續選擇）`
                        : `此方向已選 ${selected} 項（全方向共 ${totalUniqueSkills} / 10）`
                    }
                  />
                  {skillError && (
                    <p
                      role="alert"
                      className="text-status-error-default text-sm font-medium"
                    >
                      {String(skillError)}
                    </p>
                  )}
                </div>
              </div>

              <div
                id="want_topic"
                className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8"
              >
                <div className="lg:w-48 lg:shrink-0">
                  <p className="text-text-primary text-sm font-bold">
                    想了解的主題
                  </p>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <CompactCategoryPicker
                    key={`topic-${resolvedActiveDirection}`}
                    categories={wantTopicCategories}
                    value={activeTopics}
                    onChange={handleDirectionTopicsChange}
                    maxSelected={topicMaxForActive}
                    addLabel="新增主題"
                    searchPlaceholder="搜尋主題"
                    countText={`已選 ${totalUniqueTopics} / 10`}
                    limitHelperText={(selected) =>
                      totalUniqueTopics >= 10
                        ? `此方向已選 ${selected} 項（全方向共 ${totalUniqueTopics} / 10 — 取消其他項目以繼續選擇）`
                        : `此方向已選 ${selected} 項（全方向共 ${totalUniqueTopics} / 10）`
                    }
                  />
                  {topicError && (
                    <p
                      role="alert"
                      className="text-status-error-default text-sm font-medium"
                    >
                      {String(topicError)}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);
