'use client';

import { User } from 'lucide-react';

import {
  EducationSection,
  WorkExperienceSection,
} from '@/components/profile/experience-section/ExperienceSection';
import type { ResolvedDisplaySocialLink } from '@/components/profile/social-links/platformLabelMap';
import type { TagDisplay, UserType } from '@/hooks/user/user-data/useUserData';
import type { MenteeDirectionReadGroup } from '@/lib/profile/menteeDirectionView';
import { cn } from '@/lib/utils';

export interface MenteeProfileContentProps {
  userData: UserType;
  isEmpty: boolean;
  industryHashtag: string | null;
  directionGroups: ReadonlyArray<MenteeDirectionReadGroup>;
  activeDirection: string | null;
  onSelectDirection: (directionKey: string) => void;
  personalLinks: ReadonlyArray<ResolvedDisplaySocialLink>;
}

function PreferenceTagGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: ReadonlyArray<TagDisplay>;
  tone: 'skill' | 'topic';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-text-secondary mb-3 text-sm font-semibold">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => (
          <span
            key={item.subject_group}
            className={cn(
              'inline-flex items-center rounded-full font-medium',
              tone === 'skill'
                ? 'bg-brand-100 text-brand-700 px-3.5 py-1.5 text-sm'
                : 'border-background-border bg-background-white text-text-primary border px-3.5 py-1 text-xs'
            )}
          >
            {item.subject}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MenteeProfileContent({
  userData,
  isEmpty,
  industryHashtag,
  directionGroups,
  activeDirection,
  onSelectDirection,
  personalLinks,
}: MenteeProfileContentProps) {
  if (isEmpty) {
    return (
      <div
        data-testid="mentee-profile-empty-state"
        className="bg-background-bottom-secondary/70 rounded-2xl px-6 py-12 text-center"
      >
        <div className="bg-background-white text-text-tertiary mx-auto mb-3 grid size-12 place-items-center rounded-full shadow-xs">
          <User className="size-5" aria-hidden="true" />
        </div>
        <p className="text-text-secondary text-sm font-medium">
          尚未填寫個人資料
        </p>
      </div>
    );
  }

  const hasAboutSection = Boolean(userData.about?.trim() || industryHashtag);
  const hasDirectionGroups = directionGroups.length > 0;
  const hasLegacyPreferences =
    !hasDirectionGroups &&
    Boolean(userData.want_skill?.length || userData.want_topic?.length);
  const hasPreferencesSection = hasDirectionGroups || hasLegacyPreferences;

  const resolvedActiveGroup =
    directionGroups.find((g) => g.key === activeDirection) ??
    directionGroups[0] ??
    null;

  const hasWork = Boolean(userData.workExperiences?.length);
  const hasEducation = Boolean(userData.educations?.length);
  const hasPersonalLinks = personalLinks.length > 0;

  let renderedBefore = false;
  const nextSpacing = () => {
    const cls = renderedBefore
      ? 'border-background-border mt-8 border-t pt-8'
      : undefined;
    renderedBefore = true;
    return cls;
  };

  return (
    <div>
      {hasAboutSection && (
        <section className={nextSpacing()}>
          <h2
            className={cn(
              industryHashtag ? 'mb-3' : 'mb-4',
              'text-xl font-bold'
            )}
          >
            關於我
          </h2>
          {industryHashtag && (
            <p
              data-testid="mentee-industry-hashtag"
              className={cn(
                'text-brand-700 text-sm font-medium break-words',
                userData.about?.trim() && 'mb-3'
              )}
            >
              {industryHashtag}
            </p>
          )}
          {userData.about?.trim() && (
            <p className="text-text-secondary text-sm leading-relaxed break-words whitespace-pre-line">
              {userData.about}
            </p>
          )}
        </section>
      )}

      {hasPreferencesSection && (
        <section className={nextSpacing()}>
          <h2 className="mb-4 text-xl font-bold">交流偏好</h2>

          {hasDirectionGroups && resolvedActiveGroup ? (
            <div>
              <div
                role="tablist"
                aria-label="交流偏好職位方向"
                className="border-background-border mb-5 flex flex-wrap items-center gap-6 border-b"
              >
                {directionGroups.map((group) => {
                  const selected = group.key === resolvedActiveGroup.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => onSelectDirection(group.key)}
                      className={cn(
                        'focus-visible:ring-brand-500 -mb-px inline-flex items-baseline gap-1.5 border-b-2 px-1 pt-1 pb-2.5 text-sm transition-colors focus-visible:rounded-xs focus-visible:ring-2 focus-visible:outline-none',
                        selected
                          ? 'border-brand-700 text-brand-700 font-semibold'
                          : 'text-text-secondary hover:text-text-primary border-transparent font-medium'
                      )}
                    >
                      <span>{group.label}</span>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          selected ? 'text-brand-700' : 'text-text-tertiary'
                        )}
                      >
                        {group.totalCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div role="tabpanel" className="flex flex-col gap-6">
                {resolvedActiveGroup.skills.length === 0 &&
                resolvedActiveGroup.topics.length === 0 ? (
                  <p className="text-text-tertiary text-sm">
                    尚未設定此方向的技能與主題
                  </p>
                ) : (
                  <>
                    <PreferenceTagGroup
                      title="想加強的技能"
                      items={resolvedActiveGroup.skills}
                      tone="skill"
                    />
                    <PreferenceTagGroup
                      title="想了解的主題"
                      items={resolvedActiveGroup.topics}
                      tone="topic"
                    />
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <PreferenceTagGroup
                title="想加強的技能"
                items={userData.want_skill}
                tone="skill"
              />
              <PreferenceTagGroup
                title="想了解的主題"
                items={userData.want_topic}
                tone="topic"
              />
            </div>
          )}
        </section>
      )}

      {hasWork && (
        <section className={nextSpacing()}>
          <h2 className="mb-4 text-xl font-bold">工作經驗</h2>
          <WorkExperienceSection
            workExperiences={userData.workExperiences ?? []}
          />
        </section>
      )}

      {hasEducation && (
        <section className={nextSpacing()}>
          <h2 className="mb-4 text-xl font-bold">教育經歷</h2>
          <EducationSection educations={userData.educations ?? []} />
        </section>
      )}

      {hasPersonalLinks && (
        <section className={nextSpacing()}>
          <h2 className="mb-4 text-xl font-bold">個人連結</h2>
          <div className="flex flex-wrap items-center gap-2.5 p-0.5">
            {personalLinks.map((link, index) => (
              <a
                key={`${link.platform}-${index}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                data-analytics-click="profile_social_link"
                data-analytics-event="profile_social_link_click"
                data-analytics-feature="profile"
                data-analytics-location="profile_links_section"
                data-analytics-omit-destination="true"
                data-analytics-param-platform={link.platform}
                data-analytics-param-mentor-id={String(userData.user_id)}
                className="border-background-border bg-background-white text-text-primary hover:border-brand-400 hover:text-brand-700 focus-visible:ring-brand-500 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.icon}
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
