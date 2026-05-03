import { Badge } from '@/components/ui/badge';
import { TagDisplay } from '@/hooks/user/user-data/useUserData';

interface Props {
  title: string;
  items: TagDisplay[];
}

export function ProfileBadgeSection({ title, items }: Props) {
  if (!items?.length) return null;
  return (
    <div className="mt-10">
      <p className="mb-4 text-xl font-bold">{title}</p>
      <div className="flex flex-wrap gap-3">
        {items.map((i) => (
          <Badge variant="primaryAlt" key={i.subject_group}>
            {i.subject}
          </Badge>
        ))}
      </div>
    </div>
  );
}
