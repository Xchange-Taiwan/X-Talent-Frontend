import type { Reservation } from '@/types/reservation';

const nowSeconds = Math.floor(Date.now() / 1000);

// Helper to calculate relative times
const minutesFromNow = (mins: number) => nowSeconds + mins * 60;
const hoursFromNow = (hrs: number) => nowSeconds + hrs * 3600;
const daysFromNow = (days: number) => nowSeconds + days * 24 * 3600;

export const mockReservations: Reservation[] = [
  // 1. Pending Reservation (Awaiting Mentor response, viewed as Mentor)
  {
    id: 'res-pending-mentor-1',
    name: '林小英 (Chloe Lin)',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    roleLine: 'UIUX 新人 / 轉職探索中',
    date: '2026年8月10日 (星期一)',
    time: '19:00 – 20:00',
    messages: [
      {
        content:
          '導師您好！我目前正在自學 UIUX 設計，正在建立第一個作品集。想請教導師在設計 User Flow 與 Wireframe 時有沒有什麼實務上的秘訣？另外也想了解業界對於作品集最看重的部分是什麼，謝謝！',
        role: 'MENTEE',
      },
    ],
    menteeMessage: {
      content:
        '導師您好！我目前正在自學 UIUX 設計，正在建立第一個作品集。想請教導師在設計 User Flow 與 Wireframe 時有沒有什麼實務上的秘訣？另外也想了解業界對於作品集最看重的部分是什麼，謝謝！',
      role: 'MENTEE',
    },
    scheduleId: 1001,
    dtstart: daysFromNow(5),
    dtend: daysFromNow(5) + 3600,
    senderUserId: 'user-mentee-chloe',
    participantUserId: 'user-mentor-current',
  },

  // 2. Pending Reservation (Awaiting Mentor response, viewed as Mentee)
  {
    id: 'res-pending-mentee-2',
    name: '張大同 (Harrison Chang)',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    roleLine: 'LINE 台灣 Technical Lead / 雲端架構專家',
    date: '2026年8月12日 (星期三)',
    time: '21:00 – 22:00',
    messages: [
      {
        content:
          ' Harrison 導師您好！我目前任職於中型企業，團隊正在評估將傳統伺服器架構遷移至 AWS 雲端。希望能跟導師探討多租戶（Multi-tenancy）資料庫隔離、以及基礎設施即代碼（Terraform）的最佳實踐。謝謝！',
        role: 'MENTEE',
      },
    ],
    menteeMessage: {
      content:
        ' Harrison 導師您好！我目前任職於中型企業，團隊正在評估將傳統伺服器架構遷移至 AWS 雲端。希望能跟導師探討多租戶（Multi-tenancy）資料庫隔離、以及基礎設施即代碼（Terraform）的最佳實踐。謝謝！',
      role: 'MENTEE',
    },
    scheduleId: 1002,
    dtstart: daysFromNow(7),
    dtend: daysFromNow(7) + 3600,
    senderUserId: 'user-mentee-current',
    participantUserId: 'user-mentor-harrison',
  },

  // 3. Upcoming Reservation - "Far" (Starts in 3 days)
  {
    id: 'res-upcoming-far-3',
    name: '王小華 (Grace Wang)',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    roleLine: '國立台灣大學 資訊工程學系 / 碩士班二年級',
    date: '2026年8月5日 (星期三)',
    time: '14:00 – 15:00',
    messages: [
      {
        content:
          '導師您好！我目前的碩士論文方向是機器學習與邊緣運算優化。因為畢業在即，想向導師諮詢關於 AI 軟體工程師、演算法開發工程師的職涯定位，以及如何準備外商公司的白板面試與 behavior questions，謝謝！',
        role: 'MENTEE',
      },
      {
        content:
          'Grace 你好！很高興收到你的諮詢。這個論文方向非常有潛力，我當天會針對外商 AI 工程師的面試準備要領提供詳細拆解。你可以先將你目前的履歷草稿寄給我（或在對話中貼上連結），我會一併幫你進行健檢。期待與你聊聊！',
        role: 'MENTOR',
      },
    ],
    menteeMessage: {
      content:
        '導師您好！我目前的碩士論文方向是機器學習與邊緣運算優化。因為畢業在即，想向導師諮詢關於 AI 軟體工程師、演算法開發工程師的職涯定位，以及如何準備外商公司的白板面試與 behavior questions，謝謝！',
      role: 'MENTEE',
    },
    mentorMessage: {
      content:
        'Grace 你好！很高興收到你的諮詢。這個論文方向非常有潛力，我當天會針對外商 AI 工程師的面試準備要領提供詳細拆解。你可以先將你目前的履歷草稿寄給我（或在對話中貼上連結），我會一併幫你進行健檢。期待與你聊聊！',
      role: 'MENTOR',
    },
    scheduleId: 1003,
    dtstart: daysFromNow(3),
    dtend: daysFromNow(3) + 3600,
    senderUserId: 'user-mentee-grace',
    participantUserId: 'user-mentor-current',
  },

  // 4. Upcoming Reservation - "Soon" (Starts in 3 hours)
  {
    id: 'res-upcoming-soon-4',
    name: '李建國 (James Lee)',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    roleLine: '蝦皮購物 Senior Data Analyst',
    date: '今天 (2026年7月29日)',
    time: '21:00 – 22:00',
    messages: [
      {
        content:
          '導師您好！我是 James。目前團隊正在規畫基於數據驅動的行銷自動化漏斗。希望跟導師請教在大規模 A/B 測試的指標設定（例如 OEC）以及檢定效力（Statistical Power）不足時的折衷處理方案，謝謝導師！',
        role: 'MENTEE',
      },
      {
        content:
          'James 你好！非常硬核且實用的題目。大規模 A/B 測試很容易遇到雜訊干擾或指標被稀釋的情況。我當天會帶分享幾個大型網路平台使用的「敏感度提升（Variance Reduction/CUPED）」技術，以及多維度拆解分析的最佳實踐，今晚見！',
        role: 'MENTOR',
      },
    ],
    menteeMessage: {
      content:
        '導師您好！我是 James。目前團隊正在規畫基於數據驅動的行銷自動化漏斗。希望跟導師請教在大規模 A/B 測試的指標設定（例如 OEC）以及檢定效力（Statistical Power）不足時的折衷處理方案，謝謝導師！',
      role: 'MENTEE',
    },
    mentorMessage: {
      content:
        'James 你好！非常硬核且實用的題目。大規模 A/B 測試很容易遇到雜訊干擾 or 指標被稀釋。我當天會分享幾個大型網路平台使用的「敏感度提升（Variance Reduction/CUPED）」技術，以及多維度拆解分析的最佳實踐，今晚見！',
      role: 'MENTOR',
    },
    scheduleId: 1004,
    dtstart: hoursFromNow(3),
    dtend: hoursFromNow(4),
    senderUserId: 'user-mentee-james',
    participantUserId: 'user-mentor-current',
  },

  // 5. Upcoming Reservation - "Imminent" (Starts in 15 minutes)
  {
    id: 'res-upcoming-imminent-5',
    name: '葉書雅 (Sylvia Yeh)',
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    roleLine: 'Trend Micro Frontend Engineer / 工作 2 年',
    date: '今天 (2026年7月29日)',
    time: '18:40 – 19:40',
    messages: [
      {
        content:
          '導師您好，我是 Sylvia。目前工作上遇到了跨組協作的溝通瓶頸（主要是時程估計與需求變更的認知落差）。希望想跟導師請教身為前端，如何透過技術語言轉譯，與 PM 以及後端工程師建立更有信任感的同步機制，謝謝！',
        role: 'MENTEE',
      },
      {
        content:
          'Sylvia 妳好！這幾乎是所有工程師必經的痛點。時程估計與變更防範不是單純的技術問題，更多是期望值管理。我等一下會跟妳聊聊「三點估演算法」以及如何透過 API 合約先行（Schema-driven）來將依賴降到最低。等下見！',
        role: 'MENTOR',
      },
    ],
    menteeMessage: {
      content:
        '導師您好，我是 Sylvia。目前工作上遇到了跨組協作的溝通瓶頸（主要是時程估計與需求變更的認知落差）。希望想跟導師請教身為前端，如何透過技術語言轉譯，與 PM 以及後端工程師建立更有信任感的同步機制，謝謝！',
      role: 'MENTEE',
    },
    mentorMessage: {
      content:
        'Sylvia 妳好！這幾乎是所有工程師必經的痛點。時程估計與變更防範不是單純的技術問題，更多是期望值管理。我等一下會跟妳聊聊「三點估演算法」以及如何透過 API 合約先行（Schema-driven）來將依賴降到最低。等下見！',
      role: 'MENTOR',
    },
    scheduleId: 1005,
    dtstart: minutesFromNow(15),
    dtend: minutesFromNow(75),
    senderUserId: 'user-mentee-sylvia',
    participantUserId: 'user-mentor-current',
  },

  // 6. Upcoming Reservation - "Live" (Currently active!)
  {
    id: 'res-upcoming-live-6',
    name: '徐偉傑 (Albert Hsu)',
    avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    roleLine: 'CyberLink Product Manager',
    date: '今天 (2026年7月29日)',
    time: '18:00 – 19:00',
    messages: [
      {
        content:
          '導師您好！我是 Albert。在專案管理上，近期正推行敏捷開發 Scrum。但在 Sprint Planning 與 Daily Standup 時團隊成員感覺有些形式化，無法主動暴露風險。希望能向導師請教如何塑造「心理安全感」並優化 Retrospective 流程，謝謝！',
        role: 'MENTEE',
      },
      {
        content:
          'Albert 你好！Scrum 最難的是 Mindset 轉變而非流程。成員形式化通常是因為缺乏即時回饋，或擔心犯錯。我當天會透過幾個互動遊戲、以及「無指責事後檢討（Blameless Post-mortem）」的引導架構，與你深入分享實操經驗。等會見！',
        role: 'MENTOR',
      },
    ],
    menteeMessage: {
      content:
        '導師您好！我是 Albert。在專案管理上，近期正推行敏捷開發 Scrum。但在 Sprint Planning 與 Daily Standup 時團隊成員感覺有些形式化，無法主動暴露風險。希望能向導師請教如何塑造「心理安全感」並優化 Retrospective 流程，謝謝！',
      role: 'MENTEE',
    },
    mentorMessage: {
      content:
        'Albert 你好！Scrum 最難的是 Mindset 轉變而非流程。成員形式化通常是因為缺乏即時回饋，或擔心犯錯。我當天會透過幾個互動遊戲、以及「無指責事後檢討（Blameless Post-mortem）」的引導架構，與你深入分享實操經驗。等會見！',
      role: 'MENTOR',
    },
    scheduleId: 1006,
    dtstart: minutesFromNow(-15), // Started 15 mins ago
    dtend: minutesFromNow(45), // Ends in 45 mins
    senderUserId: 'user-mentee-albert',
    participantUserId: 'user-mentor-current',
  },

  // 7. History Reservation - Ended (Successful with messages, viewed as Mentor)
  {
    id: 'res-history-ended-7',
    name: '周杰倫 (Jay Chou)',
    avatar:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    roleLine: '國立清華大學 資工系四年級 / 準備轉戰產品經理',
    date: '2026年7月20日 (星期一)',
    time: '20:00 – 21:00',
    messages: [
      {
        content:
          '導師您好！我是 Jay。我雖然是資工背景，但我更希望未來能成為跨領域的產品經理。我想請教導師，身為無經驗的畢業生，應如何展現自己的優勢？有哪些產品管理相關的實體社群、專案活動是推薦可以參與的？謝謝！',
        role: 'MENTEE',
      },
      {
        content:
          'Jay 你好！資工背景在產品經理中其實非常搶手（尤其是 Technical PM 領域）。我們對談時，我會幫你剖析如何把資工的系統性思考、邏輯與數據分析能力，包裝成產品管理的優勢。也會分享目前最活躍的 PM 社群資源給你。期待交流！',
        role: 'MENTOR',
      },
    ],
    menteeMessage: {
      content:
        '導師您好！我是 Jay。我雖然是資工背景，但我更希望未來能成為跨領域的產品經理。我想請教導師，身為無經驗的畢業生，應如何展現自己的優勢？有哪些產品管理相關的實體社群、專案活動是推薦可以參與的？謝謝！',
      role: 'MENTEE',
    },
    mentorMessage: {
      content:
        'Jay 你好！資工背景在產品經理中其實非常搶手（尤其是 Technical PM 領域）。我們對談時，我會幫你剖析如何把資工的系統性思考、邏輯與數據分析能力，包裝成產品管理的優勢。也會分享目前最活躍的 PM 社群資源給你。期待交流！',
      role: 'MENTOR',
    },
    scheduleId: 1007,
    dtstart: daysFromNow(-9),
    dtend: daysFromNow(-9) + 3600,
    senderUserId: 'user-mentee-jay',
    participantUserId: 'user-mentor-current',
  },

  // 8. History Reservation - Cancelled by Mentor (Viewed as Mentee)
  {
    id: 'res-history-cancelled-mentor-8',
    name: '林建華 (Arthur Lin)',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    roleLine: 'Microsoft 總部 Senior Azure Principal Consultant',
    date: '2026年7月15日 (星期三)',
    time: '10:00 – 11:00',
    messages: [
      {
        content:
          'Arthur 導師您好，非常感謝您撥空。我想向您請教關於微服務（Microservices）架構下的分散式交易處理（Saga Pattern vs 2PC）的最佳決策路徑，以及在 Azure 平台上的落地經驗。謝謝您！',
        role: 'MENTEE',
      },
    ],
    menteeMessage: {
      content:
        'Arthur 導師您好，非常感謝您撥空。我想向您請教關於微服務（Microservices）架構下的分散式交易處理（Saga Pattern vs 2PC）的最佳決策路徑，以及在 Azure 平台上的落地經驗。謝謝您！',
      role: 'MENTEE',
    },
    scheduleId: 1008,
    dtstart: daysFromNow(-14),
    dtend: daysFromNow(-14) + 3600,
    senderUserId: 'user-mentee-current',
    participantUserId: 'user-mentor-arthur',
    cancelledBy: 'MENTOR',
  },

  // 9. History Reservation - Cancelled by Mentee (Viewed as Mentor)
  {
    id: 'res-history-cancelled-mentee-9',
    name: '蔡依林 (Jolin Tsai)',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    roleLine: '新創公司 UIUX 設計師 / 工作 1 年',
    date: '2026年7月10日 (星期五)',
    time: '15:00 – 16:00',
    messages: [
      {
        content:
          '導師您好，目前團隊剛開始推行 Design System，我們遇到了多語系命名、Dark Mode 語意色彩定義的實務問題。想向導師取經，了解在中大型專案中如何建立持久且彈性的 Token 系統。謝謝！',
        role: 'MENTEE',
      },
    ],
    menteeMessage: {
      content:
        '導師您好，目前團隊剛開始推行 Design System，我們遇到了多語系命名、Dark Mode 語意色彩定義的實務問題。想向導師取經，了解在中大型專案中如何建立持久且彈性的 Token 系統。謝謝！',
      role: 'MENTEE',
    },
    scheduleId: 1009,
    dtstart: daysFromNow(-19),
    dtend: daysFromNow(-19) + 3600,
    senderUserId: 'user-mentee-jolin',
    participantUserId: 'user-mentor-current',
    cancelledBy: 'MENTEE',
  },
];
