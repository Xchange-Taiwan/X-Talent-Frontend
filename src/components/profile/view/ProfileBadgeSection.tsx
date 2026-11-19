import { Badge } from '@/components/ui/badge';
import { TagDisplay } from '@/hooks/user/user-data/useUserData';
import { cn } from '@/lib/utils';

export type ProfilePillVariant = 'default' | 'brand' | 'subtle';

interface Props {
  title: string;
  items: TagDisplay[];
  tone?: ProfilePillVariant;
  subheading?: boolean;
}

export function ProfileBadgeSection({
  title,
  items,
  tone = 'default',
  subheading = false,
}: Props) {
  if (!items?.length) return null;
  return (
    <div className={subheading ? undefined : 'mt-10'}>
      {subheading ? (
        <h3 className="text-text-secondary mb-3 text-sm font-semibold">
          {title}
        </h3>
      ) : (
        <p className="mb-4 text-xl font-bold">{title}</p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {items.map((i) =>
          tone === 'default' ? (
            <Badge variant="default" key={i.subject_group}>
              {i.subject}
            </Badge>
          ) : (
            <span
              key={i.subject_group}
              className={cn(
                'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium',
                tone === 'brand'
                  ? 'bg-brand-100 text-brand-700'
                  : 'border-background-border bg-background-bottom-secondary/70 text-text-primary border'
              )}
            >
              {i.subject}
            </span>
          )
        )}
      </div>
    </div>
  );
}
