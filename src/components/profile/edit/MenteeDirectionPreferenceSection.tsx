'use client';

import React, { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import {
  type Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';
import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  computeDirectionSelectLimit,
  type MenteeDirectionMap,
  syncMenteePositions,
  updateDirectionBucket,
} from '@/lib/profile/menteeDirectionPreference';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

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

export function MenteeDirectionPreferenceSection({
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

  const {
    formState: { errors, isSubmitted },
  } = form;

  const handlePositionsChange = (nextPositions: string[]) => {
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
    <section
      id="want_position"
      data-testid="mentee-section-preferences"
      className="border-background-border bg-background-white space-y-6 rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 className="text-text-primary text-xl font-bold">交流偏好</h2>
        <p className="text-text-tertiary mt-1 text-sm">用來推薦適合的導師</p>
      </div>

      <div className="space-y-2">
        <p className="text-text-primary text-sm font-semibold">
          有興趣多了解的職位
        </p>
        <CategoryMultiSelect
          categories={wantPositionCategories}
          value={selectedPositions}
          onChange={handlePositionsChange}
          maxSelected={10}
          searchPlaceholder="搜尋職位"
        />
        {positionError && (
          <p className="text-status-error-default text-sm font-medium">
            {String(positionError)}
          </p>
        )}
      </div>

      <div
        id="want_skill"
        data-testid="mentee-direction-panel"
        className="border-background-border bg-background-bottom/40 space-y-5 rounded-xl border p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-text-primary text-sm font-semibold">
            依方向選擇技能與主題
          </p>
        </div>

        {selectedPositions.length === 0 ? (
          <div className="space-y-2">
            <p className="text-text-tertiary py-3 text-sm">
              請先在上方選擇至少 1 個職位方向，再依方向挑選想加強的技能與主題。
            </p>
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
        ) : (
          <>
            <div
              role="tablist"
              aria-label="職位方向"
              className="flex flex-wrap gap-2 p-0.5"
            >
              {selectedPositions.map((posCode) => {
                const isSelected = posCode === resolvedActiveDirection;
                const label = positionLabelMap.get(posCode) ?? posCode;
                return (
                  <button
                    key={posCode}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveDirectionState(posCode)}
                    className={cn(
                      'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                      isSelected
                        ? 'border-brand-700 bg-brand-700 text-background-white'
                        : 'border-background-border bg-background-white text-text-secondary hover:text-text-primary focus-visible:border-ring',
                      FOCUS_RING_NO_OFFSET_CLASSES
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-text-primary text-sm font-semibold">
                想多了解、加強的技能
              </p>
              <CategoryMultiSelect
                key={`skill-${resolvedActiveDirection}`}
                categories={wantSkillCategories}
                value={activeSkills}
                onChange={handleDirectionSkillsChange}
                maxSelected={skillMaxForActive}
                searchPlaceholder="搜尋技能"
                limitHelperText={(selected) =>
                  totalUniqueSkills >= 10
                    ? `此方向已選 ${selected} 項（全方向共 ${totalUniqueSkills} / 10 — 取消其他項目以繼續選擇）`
                    : `此方向已選 ${selected} 項（全方向共 ${totalUniqueSkills} / 10）`
                }
              />
              {skillError && (
                <p className="text-status-error-default text-sm font-medium">
                  {String(skillError)}
                </p>
              )}
            </div>

            <div id="want_topic" className="space-y-2">
              <p className="text-text-primary text-sm font-semibold">
                想多了解的主題
              </p>
              <CategoryMultiSelect
                key={`topic-${resolvedActiveDirection}`}
                categories={wantTopicCategories}
                value={activeTopics}
                onChange={handleDirectionTopicsChange}
                maxSelected={topicMaxForActive}
                searchPlaceholder="搜尋主題"
                limitHelperText={(selected) =>
                  totalUniqueTopics >= 10
                    ? `此方向已選 ${selected} 項（全方向共 ${totalUniqueTopics} / 10 — 取消其他項目以繼續選擇）`
                    : `此方向已選 ${selected} 項（全方向共 ${totalUniqueTopics} / 10）`
                }
              />
              {topicError && (
                <p className="text-status-error-default text-sm font-medium">
                  {String(topicError)}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
