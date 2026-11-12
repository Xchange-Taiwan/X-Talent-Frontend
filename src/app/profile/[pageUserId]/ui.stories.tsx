import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';

import defaultAvatar from '@/assets/default-avatar.png';
import { mockBookingSlots } from '@/components/profile/reservation/__mocks__/reservationStories.mock';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import type { BookingCalendarReader } from '@/lib/profile/bookingAvailability';
import type { MentorFeedbackItem } from '@/types/feedback';

import ProfilePageUI from './ui';

const meta: Meta<typeof ProfilePageUI> = {
  title: '業務模組元件/個人檔案(Profile)/ProfilePageUI',
  component: ProfilePageUI,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ProfilePageUI>;

const today = dayjs();
const tomorrowStr = today.add(1, 'day').format('YYYY-MM-DD');
const nextWeekStr = today.add(7, 'day').format('YYYY-MM-DD');

const mockFeedbackItems: MentorFeedbackItem[] = [
  {
    id: 'fb-1',
    authorName: '陳**',
    rating: 9,
    content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'fb-2',
    authorName: '林**',
    rating: 8,
    content: '從作品集的架構到研究故事，都給了我可以實際執行的修改方向。',
    createdAt: '2026-10-27T14:30:00Z',
  },
  {
    id: 'fb-3',
    authorName: '王**',
    rating: 9,
    content: '很有耐心地回答問題，會談前也有先了解我的需求。',
    createdAt: '2026-10-26T09:15:00Z',
  },
];

const mockMentorUserData: UserType = {
  user_id: 101,
  name: '陳怡君 (Jane Chen)',
  avatar: defaultAvatar.src,
  job_title: 'Senior Product Designer',
  company: 'Google',
  is_mentor: true,
  about: `擁有 8 年以上跨國數位產品設計經驗，曾主導多個大型 B2B 與 B2C 產品的設計系統與互動體驗優化。

擅長領域包含：
1. 跨國產品設計與體驗策略
2. 設計系統 (Design System) 架構與落地
3. 作品集健檢與跨國職涯規劃`,
  personal_statement: `歡迎預約一對一諮詢！
1. 請事先準備想討論的問題清單
2. 若需作品集健檢，請於預約留言附上連結`,
  years_of_experience: '5~10 年',
  location: '台灣',
  industry: '設計及創意相關業',
  industries: [{ subject_group: 'design', subject: '設計及創意相關業' }],
  stats: {
    completed_meeting_count: 128,
    rating_count: 12,
    rating_average: 8.5,
  },
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [
    { subject_group: 'figma', subject: 'Figma' },
    { subject_group: 'design_system', subject: 'Design System' },
    { subject_group: 'user_research', subject: 'User Research' },
  ],
  have_topic: [
    { subject_group: 'portfolio_review', subject: '作品集與履歷健檢' },
    { subject_group: 'career_coaching', subject: '設計職涯規劃' },
    { subject_group: 'mock_interview', subject: '模擬面試' },
  ],
  workExperiences: [
    {
      job: 'Senior Product Designer',
      company: 'Google',
      job_period_start: '2022',
      job_period_end: '至今',
      industry: 'Software',
      job_location: 'TWN',
      description: `負責 Cloud Console 核心工作流設計與跨產品 Design System 演進。
1. 主導 5 個產品線的設計系統元件收斂
2. 與跨時區工程與產品團隊協作推動無障礙設計規範`,
      is_primary: true,
    },
    {
      job: 'UI/UX Designer',
      company: 'Line',
      job_period_start: '2019',
      job_period_end: '2022',
      industry: 'Software',
      job_location: 'TWN',
      description: '主導行動端電商與支付體驗改版，提升結帳轉換率 18%。',
      is_primary: false,
    },
  ],
  educations: [
    {
      subject: '資訊管理學系 (Information Management)',
      school: '國立臺灣大學',
      education_period_start: '2017',
      education_period_end: '2019',
    },
  ],
  personalLinks: [
    { platform: 'linkedin', url: 'https://www.linkedin.com/in/jane-chen' },
    { platform: 'website', url: 'https://janechen.design' },
  ],
};

const mockMenteeUserData: UserType = {
  user_id: 202,
  name: '王小明 (Alex Wang)',
  avatar: defaultAvatar.src,
  job_title: 'Frontend Developer',
  company: 'Startup Studio',
  is_mentor: false,
  about:
    '目前擔任前端工程師，專注於 React 與 TypeScript 開發，希望能向資深工程師請教大型系統架構設計與跨國團隊協作經驗。',
  years_of_experience: '1~3 年',
  industry: '網際網路 / 軟體',
  want_position: [
    { subject_group: 'frontend_engineer', subject: '前端工程師' },
    { subject_group: 'fullstack_engineer', subject: '全端工程師' },
  ],
  want_skill: [
    { subject_group: 'react', subject: 'React' },
    { subject_group: 'typescript', subject: 'TypeScript' },
    { subject_group: 'system_design', subject: 'System Design' },
  ],
  want_topic: [
    { subject_group: 'career_planning', subject: '職涯發展諮詢' },
    { subject_group: 'resume_review', subject: '履歷健檢' },
  ],
  have_skill: [],
  have_topic: [],
  workExperiences: [
    {
      job: 'Frontend Developer',
      company: 'Startup Studio',
      job_period_start: '2024',
      job_period_end: '至今',
      industry: 'Software',
      job_location: 'TWN',
      description: '負責 SaaS 儀表板前端架構與元件庫建置。',
      is_primary: true,
    },
  ],
  educations: [
    {
      subject: '資訊科學系 (Computer Science)',
      school: '國立政治大學',
      education_period_start: '2019',
      education_period_end: '2023',
    },
  ],
  personalLinks: [{ platform: 'github', url: 'https://github.com/alex-wang' }],
};

const baseScheduleReader: BookingCalendarReader = {
  year: today.add(1, 'day').year(),
  month: today.add(1, 'day').month() + 1,
  selectedDate: tomorrowStr,
  setSelectedDate: () => {},
  allowedDates: [tomorrowStr, nextWeekStr],
  slotsSnapshot: {
    slots: mockBookingSlots,
    monthLoaded: true,
    reservationsLoaded: true,
  },
  getDayBookingStatus: (dateKey: string) =>
    dateKey === tomorrowStr
      ? 'PENDING'
      : dateKey === nextWeekStr
        ? 'BOOKED'
        : null,
  isFetching: false,
  hasError: false,
  reload: async () => {},
};

export const MentorOwnerView: Story = {
  args: {
    userData: mockMentorUserData,
    userLoading: false,
    schedule: baseScheduleReader,
    scheduleLoaded: true,
    feedback: {
      items: mockFeedbackItems,
      totalRatingCount: 12,
      ratingAverage: 8.5,
      hasLoaded: true,
      isLoading: false,
    },
    loginUserId: '101',
    isIdentityResolved: true,
    canShowOwnerControls: true,
    avatarSrc: defaultAvatar,
    allowedDates: [tomorrowStr, nextWeekStr],
    onReservation: () => {},
    onEditProfile: () => {},
    onBecomeMentor: () => {},
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    onConfirmReservation: async () => true,
  },
};

export const MentorVisitorView: Story = {
  args: {
    userData: mockMentorUserData,
    userLoading: false,
    schedule: {
      ...baseScheduleReader,
      slotsSnapshot: {
        slots: mockBookingSlots.filter((s) => !s.isBooked && s.status === null),
        monthLoaded: true,
        reservationsLoaded: true,
      },
    },
    scheduleLoaded: true,
    feedback: {
      items: mockFeedbackItems,
      totalRatingCount: 12,
      ratingAverage: 8.5,
      hasLoaded: true,
      isLoading: false,
    },
    loginUserId: '202',
    isIdentityResolved: true,
    canShowOwnerControls: false,
    avatarSrc: defaultAvatar,
    allowedDates: [tomorrowStr, nextWeekStr],
    onReservation: () => {},
    onEditProfile: () => {},
    onBecomeMentor: () => {},
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    onConfirmReservation: async () => true,
  },
};

export const MentorFeedbackTabActive: Story = {
  args: {
    ...MentorVisitorView.args,
    defaultTab: 'feedback',
  },
};

export const MentorZeroReviewsEmptyState: Story = {
  args: {
    ...MentorVisitorView.args,
    userData: {
      ...mockMentorUserData,
      stats: {
        completed_meeting_count: 128,
        rating_count: 0,
        rating_average: null,
      },
    },
    feedback: {
      items: [],
      totalRatingCount: 0,
      ratingAverage: null,
      hasLoaded: true,
      isLoading: false,
    },
    defaultTab: 'feedback',
  },
};

export const MentorNewZeroSessionsAndZeroReviews: Story = {
  args: {
    ...MentorVisitorView.args,
    userData: {
      ...mockMentorUserData,
      stats: {
        completed_meeting_count: 0,
        rating_count: 0,
        rating_average: null,
      },
    },
    feedback: {
      items: [],
      totalRatingCount: 0,
      ratingAverage: null,
      completedMeetingCount: 0,
      hasLoaded: true,
      isLoading: false,
    },
    defaultTab: 'feedback',
  },
};

export const MenteeProfileView: Story = {
  args: {
    userData: mockMenteeUserData,
    userLoading: false,
    schedule: {
      ...baseScheduleReader,
      allowedDates: [],
      slotsSnapshot: { slots: [], monthLoaded: true, reservationsLoaded: true },
    },
    scheduleLoaded: true,
    loginUserId: '202',
    isIdentityResolved: true,
    canShowOwnerControls: true,
    avatarSrc: defaultAvatar,
    allowedDates: [],
    onReservation: () => {},
    onEditProfile: () => {},
    onBecomeMentor: () => {},
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    onConfirmReservation: async () => true,
  },
};

export const LoadingSkeleton: Story = {
  args: {
    userData: null,
    userLoading: true,
    schedule: {
      ...baseScheduleReader,
      slotsSnapshot: {
        slots: [],
        monthLoaded: false,
        reservationsLoaded: false,
      },
    },
    scheduleLoaded: false,
    loginUserId: '',
    isIdentityResolved: false,
    canShowOwnerControls: false,
    avatarSrc: defaultAvatar,
    allowedDates: [],
    onReservation: () => {},
    onEditProfile: () => {},
    onBecomeMentor: () => {},
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    onConfirmReservation: async () => true,
  },
};
