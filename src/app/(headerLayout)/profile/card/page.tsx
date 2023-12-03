'use client';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui/button';

export default function Page() {
  return (
    <div className="pb-20 pt-10">
      <div className="text-center">
        <p className="mb-3 text-xl font-bold">註冊完成！</p>
        <p className="text-base">以下是你的個人名片</p>
      </div>
      <div className="py-10">
        {/* TODO: 待處理取資料 API 邏輯 */}
        <ProfileCard
          name={'Martin Lin'}
          region={'台北市'}
          company={'Hahow'}
          jobTitle={'前端工程師'}
          school={'國立中正大學'}
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
      <div className="flex justify-center px-5">
        <Button variant="default" className="w-full max-w-sm">
          回到個人主頁
        </Button>
      </div>
    </div>
  );
}
