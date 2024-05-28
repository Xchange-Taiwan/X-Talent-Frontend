'use client';
import { useRouter } from 'next/navigation';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="mx-auto w-11/12 max-w-[630px] pb-20 pt-10">
      <div className="text-center">
        <p className="mb-3 text-4xl font-bold">恭喜你完成個人頁面的建立！</p>
        <p className="text-base">
          Now you can explore mentors or build your mentor profile in just 1
          step.
        </p>
      </div>

      <div className="py-10">
        {/* TODO: 待處理取資料 API 邏輯 */}
        <ProfileCard
          name={'Martin Lin'}
          company={'Hahow'}
          jobTitle={'前端工程師'}
          linkedinUrl={'https://www.linkedin.com/in/cheng-yi-lin/'}
          interestedRole={['UI_UX_DESIGNER', 'BUSINESS_DEVELOPMENT']}
          skillEnhancementTarget={['JAVASCRIPT', 'SQL', 'STRATEGY_PLANNING']}
          talkTopic={[
            'RESUME_CHECKUP',
            'MOCK_INTERVIEW',
            'COMPANY_CULTURE_OPPORTUNITIES',
            'INDUSTRY_KNOWLEDGE',
            'JOB_POSITION_EXPERTISE',
          ]}
        />
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          className="grow rounded-full px-6  py-3 sm:grow-0"
          onClick={() => router.push('/profile/expertise')}
        >
          成為 Mentor
        </Button>
        <Button
          variant="default"
          className="grow rounded-full px-6 py-3 sm:grow-0"
        >
          開始探索 Talent
        </Button>
      </div>
    </div>
  );
}
