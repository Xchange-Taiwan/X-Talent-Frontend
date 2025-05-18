import { useLayoutEffect, useRef, useState } from 'react';

import { InterestType } from '@/services/searchMentor/mentors';

import { Skill } from './Skill';

interface InformationProps {
  name: string;
  job_title: string;
  company: string;
  personalStatment: string;
  skills: InterestType[];
}

export const Information = ({
  name,
  job_title,
  company,
  personalStatment,
  skills,
}: InformationProps) => {
  const skillsContainerRef = useRef<HTMLDivElement>(null);
  const [visibleSkillsCount, setVisibleSkillsCount] = useState(skills.length);

  useLayoutEffect(() => {
    const checkSkillsInLine = () => {
      if (!skillsContainerRef.current) return;

      const container = skillsContainerRef.current;
      const skillElements = container.children;
      if (skillElements.length === 0) return;

      const containerWidth = container.offsetWidth;
      let lastVisibleIndex = 0;
      let totalWidth = 52;

      for (let i = 0; i < skillElements.length; i++) {
        const skillWidth = skillElements[i].getBoundingClientRect().width;
        const gap = i > 0 ? 8 : 0;
        totalWidth += skillWidth + gap;
        if (totalWidth > containerWidth) {
          lastVisibleIndex = i - 1;
          break;
        }
        lastVisibleIndex = i;
      }

      setVisibleSkillsCount(Math.min(lastVisibleIndex + 1, skills.length));
    };

    checkSkillsInLine();
  }, []);

  const visibleSkills = skills.slice(0, visibleSkillsCount);
  const extraSkillsCount = skills.length - visibleSkillsCount;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold tracking-[0.5px]">{name}</h3>
        <div className="flex gap-[6px] text-sm font-normal tracking-wide">
          {job_title}
          <span className="text-[#9DA8B9]">at</span>
          {company}
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-normal tracking-wide text-[#9DA8B9]">
        {personalStatment}
      </p>
      <div ref={skillsContainerRef} className="flex flex-wrap gap-2">
        {visibleSkills.map((skill, index) => (
          <Skill skill={skill.subject} key={index} />
        ))}
        {extraSkillsCount > 0 && (
          <Skill skill={`+${extraSkillsCount}`} key="extra" />
        )}
      </div>
    </div>
  );
};
