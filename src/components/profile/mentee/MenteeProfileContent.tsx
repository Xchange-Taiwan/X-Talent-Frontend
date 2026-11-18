'use client';

import {
  EducationSection,
  WorkExperienceSection,
} from '@/components/profile/experience-section/ExperienceSection';
import type { ResolvedDisplaySocialLink } from '@/components/profile/social-links/platformLabelMap';
import { Badge } from '@/components/ui/badge';
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
}: {
  title: string;
  items: ReadonlyArray<TagDisplay>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-text-secondary mb-3 text-sm font-semibold">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => (
          <Badge variant="default" key={item.subject_group}>
            {item.subject}
          </Badge>
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
        className="border-background-border bg-background-bottom-secondary/40 rounded-2xl border border-dashed px-6 py-12 text-center"
      >
        <p className="text-text-tertiary text-sm font-medium">
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
    const cls = renderedBefore ? 'mt-10' : undefined;
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
            <p className="text-text-tertiary text-sm break-words whitespace-pre-line">
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
                className="mb-5 flex flex-wrap items-center gap-2 p-1"
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
                        'focus-visible:ring-brand-500 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                        selected
                          ? 'border-brand-700 bg-brand-700 text-text-white'
                          : 'border-background-border bg-background-white text-text-secondary hover:border-brand-300 hover:text-text-primary'
                      )}
                    >
                      <span>{group.label}</span>
                      <span
                        className={cn(
                          'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                          selected
                            ? 'bg-background-white/20 text-text-white'
                            : 'bg-background-bottom-secondary text-text-tertiary'
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
                    />
                    <PreferenceTagGroup
                      title="想了解的主題"
                      items={resolvedActiveGroup.topics}
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
              />
              <PreferenceTagGroup
                title="想了解的主題"
                items={userData.want_topic}
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
