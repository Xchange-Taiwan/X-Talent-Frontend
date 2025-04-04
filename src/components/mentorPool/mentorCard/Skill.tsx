import { FC } from 'react';

interface SkillProps {
  skill: string;
}

export const Skill: FC<SkillProps> = ({ skill }) => {
  return (
    <div className="rounded-md border border-[#E6E8EA] px-3 py-1.5 text-sm font-medium tracking-wide">
      {skill}
    </div>
  );
};
