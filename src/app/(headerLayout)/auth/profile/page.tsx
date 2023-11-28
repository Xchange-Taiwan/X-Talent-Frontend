'use client';

import * as Progress from '@radix-ui/react-progress';
import { Form, Formik } from 'formik';
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from 'react';

import iPadImgUrl from '@/assets/auth/iPad-cover.png';
import {
  Company,
  Experience,
  Interview,
  Knowledge,
  Resume,
} from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectOptions } from '@/components/ui/selectOptions';

interface ProgressContextProps {
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
}

interface StepOneProps {
  next: (newData: object) => void;
  data: object;
}

interface StepTwoProps {
  next: (newData: object) => void;
  prev: (newData: object) => void;
  data: object;
}

interface StepThreeProps {
  next: (newData: object) => void;
  prev: (newData: object) => void;
  data: object;
}

interface StepFourProps {
  prev: (newData: object) => void;
  data: object;
}

const regionSelectItem = {
  label: '地區',
  placeholder: '請選擇您的所在地區',
  options: [
    '台北市',
    '新北市',
    '宜蘭縣',
    '基隆市',
    '桃園市',
    '新竹縣市',
    '苗栗縣',
    '台中市',
    '彰化縣',
    '南投縣',
    '雲林縣',
    '嘉義縣市',
    '台南市',
    '高雄市',
    '屏東縣',
    '台東縣',
    '花蓮縣',
    '澎湖縣',
    '金門縣',
    '連江縣',
    '亞洲其他地區',
    '大洋洲',
    '美加地區',
    '中南美洲',
    '歐洲',
    '非洲',
  ],
};

const experienceSelectItem = {
  label: '總年資',
  placeholder: '請選擇您的年資區間',
  options: ['1 年以下', '1~3 年', '3~5 年', '5~10 年', '10 年以上'],
};

const industrySelectItem = {
  label: '產業',
  placeholder: '請選擇您的產業類別',
  options: [
    '軟體及網路相關',
    '電信及通訊相關',
    '電腦及消費性電子製造業',
    '半導體業',
    '金融業',
    '顧問業',
    '學生',
    '其他',
  ],
};

const ProgressContext = createContext<ProgressContextProps>({
  progress: 0,
  setProgress: () => {},
});

const StepOne: React.FC<StepOneProps> = ({ next, data }) => {
  const { setProgress } = useContext(ProgressContext);
  const handleSubmit = (values: object) => {
    next(values);
    setProgress(50);
  };

  return (
    <Formik initialValues={data} onSubmit={handleSubmit}>
      {() => (
        <Form className="flex w-full items-center justify-center">
          <div className="max-h-[calc(100vh_-_70px)] w-full max-w-[800px] p-16">
            <h1 className="mb-8 text-[32px] font-bold leading-tight">
              我的個人資訊
            </h1>
            <div className="flex flex-col gap-4">
              <div className="grid items-center gap-1.5">
                <Label htmlFor="email">姓名*</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="請填入您的 E-mail"
                />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="region">地區*</Label>
                <SelectOptions selectItemData={regionSelectItem} />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="experience">總年資</Label>
                <SelectOptions selectItemData={experienceSelectItem} />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="industry">產業</Label>
                <SelectOptions selectItemData={industrySelectItem} />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="title">職稱（正職、實習皆可）</Label>
                <Input id="title" type="text" placeholder="請填入您的職稱" />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="company">公司（正職、實習皆可）</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="請填入您的公司名稱"
                />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="school">學校*</Label>
                <Input
                  id="school"
                  type="text"
                  placeholder="請填入您的學校名稱"
                />
              </div>

              <div className="grid items-center gap-2">
                <Label htmlFor="linkedin">Linkedin 個人檔案</Label>
                <Input
                  id="linkedin"
                  type="url"
                  placeholder="請提供您的個人檔案連結"
                />
              </div>

              <Button
                type="submit"
                className="my-8 ms-auto h-12 w-32 rounded-full"
              >
                下一步
              </Button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
};

const StepTwo: React.FC<StepTwoProps> = ({ next, data }) => {
  const { setProgress } = useContext(ProgressContext);
  // const handlePrevStep = (values: object) => {
  //   prev(values);
  //   setProgress(25);
  // };

  const handleSubmit = (values: object) => {
    next(values);
    setProgress(75);
  };

  const jobButtonGroups = [
    [
      { iconLabel: '💻 前端工程師' },
      { iconLabel: '🚀 行銷專員' },
      { iconLabel: '📊 數據分析師' },
      { iconLabel: '📈 銷售人員' },
    ],
    [
      { iconLabel: '📊 專案經理' },
      { iconLabel: '🌠 平面設計師' },
      { iconLabel: '📃 財務管理人員' },
    ],
    [
      { iconLabel: '🏛 人力資源管理' },
      { iconLabel: '🌈 內容行銷寫手' },
      { iconLabel: '💡 產品經理' },
    ],
    [
      { iconLabel: '💻 前端工程師' },
      { iconLabel: '🚀 行銷專員' },
      { iconLabel: '💎 UX/UI 設計師' },
      { iconLabel: '📈 銷售人員' },
    ],
  ];

  return (
    <Formik initialValues={data} onSubmit={handleSubmit}>
      {() => (
        <Form className="flex w-full items-center justify-center">
          <div className="max-h-[calc(100vh_-_70px)] w-full max-w-[800px] p-8">
            <h1 className="mb-8 text-center text-[32px] font-bold leading-tight">
              你有興趣的職位或領域？
            </h1>
            <div className="flex flex-col items-center">
              {jobButtonGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.map((job, jobIndex) => (
                    <button
                      type="button"
                      key={jobIndex}
                      className="text-block mx-2 my-2 h-12 rounded-[8px] border-2 border-[#D2D2D2] bg-white p-3 hover:border-[#2CCBCB] hover:bg-[#10DBBF0D]"
                    >
                      {job.iconLabel}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="mr-8 text-right">
              {/* <Button onClick={handlePrevStep} type="submit" className="h-12 w-32 my-8 rounded-full">上一步</Button> */}
              <span className="mr-12 font-medium">略過</span>
              <Button type="submit" className="my-8 h-12 w-32 rounded-full">
                下一步
              </Button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
};

const StepThree: React.FC<StepThreeProps> = ({ next, data }) => {
  const { setProgress } = useContext(ProgressContext);
  // const handlePrevStep = (values: object) => {
  //   prev(values);
  //   setProgress(50);
  // };

  const handleSubmit = (values: object) => {
    next(values);
    setProgress(100);
  };

  const buttonLabels = [
    '產品企劃',
    '專案管理',
    '策略規劃',
    '用戶體驗設計',
    '跨部門溝通',
    '商業分析',
    '陌生開發',
    '簡報製作',
    'Python',
    'Javascript',
    'SQL',
    '簡報製作',
  ];

  return (
    <Formik initialValues={data} onSubmit={handleSubmit}>
      {() => (
        <Form className="flex w-full items-center justify-center">
          <div className="max-h-[calc(100vh_-_70px)] w-full max-w-[800px] p-8">
            <h1 className="mb-8 text-center text-[32px] font-bold leading-tight">
              你想精進的能力？
            </h1>
            <div className="m-auto grid max-w-[550px] grid-cols-2 justify-items-center">
              {buttonLabels.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  className="text-block mx-2 my-2 h-12 w-64 rounded-[8px] border-2 border-[#D2D2D2] bg-white p-3 hover:border-[#2CCBCB] hover:bg-[#10DBBF0D]"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mr-8 text-right">
              {/* <Button onClick={handlePrevStep} type="submit" className="h-12 w-32 my-8 rounded-full">上一步</Button> */}
              <span className="mr-12 font-medium">略過</span>
              <Button type="submit" className="my-8 h-12 w-32 rounded-full">
                下一步
              </Button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
};

const StepFour: React.FC<StepFourProps> = ({ data }) => {
  const { setProgress } = useContext(ProgressContext);
  // const handlePrevStep = (values: object) => {
  //   prev(values);
  //   setProgress(50);
  // };

  const handleSubmit = () => {
    setProgress(100);
  };

  const buttonsInfo = [
    { icon: <Knowledge />, label: '產業知識' },
    { icon: <Company />, label: '公司文化/機會' },
    { icon: <Resume />, label: '履歷健檢' },
    { icon: <Experience />, label: '求職經驗分享' },
    { icon: <Interview />, label: '模擬面試' },
    { icon: <Knowledge />, label: '職位專業知識' },
  ];

  return (
    <Formik initialValues={data} onSubmit={handleSubmit}>
      {() => (
        <Form className="flex w-full items-center justify-center">
          <div className="max-h-[calc(100vh_-_70px)] w-full max-w-[800px] p-8">
            <h1 className="mb-8 text-center text-[32px] font-bold leading-tight">
              你想聊聊哪方面的主題？
            </h1>
            <div className="m-auto grid max-w-[550px] grid-cols-2 justify-items-center">
              {buttonsInfo.map((button, index) => (
                <button
                  key={index}
                  type="button"
                  className="text-block mx-2 my-2 flex h-32 w-64 flex-col items-center justify-center rounded-[8px] border-2 border-[#D2D2D2] bg-white p-3 hover:border-[#2CCBCB] hover:bg-[#10DBBF0D]"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EBFBFB]">
                    {button.icon}
                  </div>
                  {button.label}
                </button>
              ))}
            </div>
            <div className="mr-8 text-right">
              {/* <Button onClick={handlePrevStep} type="submit" className="h-12 w-32 my-8 rounded-full">上一步</Button> */}
              <span className="mr-12 font-medium">略過</span>
              <Button type="submit" className="my-8 h-12 w-32 rounded-full">
                完成
              </Button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default function Page() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({});

  const [progress, setProgress] = useState(25);

  const handleNextStep = (newData: object) => {
    setData((prev) => ({ ...prev, ...newData }));
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = (newData: object) => {
    setData((prev) => ({ ...prev, ...newData }));
    setCurrentStep((prev) => prev - 1);
  };

  const steps = [
    <StepOne key="stepOne" next={handleNextStep} data={data} />,
    <StepTwo
      key="stepOne"
      next={handleNextStep}
      prev={handlePrevStep}
      data={data}
    />,
    <StepThree
      key="stepOne"
      next={handleNextStep}
      prev={handlePrevStep}
      data={data}
    />,
    <StepFour key="stepOne" prev={handlePrevStep} data={data} />,
  ];

  return (
    <ProgressContext.Provider value={{ progress, setProgress }}>
      <div className="flex h-[calc(100vh_-_70px)]">
        <div
          className="hidden flex-1 bg-cover bg-right bg-no-repeat sm:block"
          style={{ backgroundImage: `url(${iPadImgUrl.src})` }}
        />
        <Progress.Root
          className="bg-blackA9 absolute h-[8px] w-screen overflow-hidden"
          style={{ transform: 'translateZ(0)' }}
          value={progress}
        >
          <Progress.Indicator
            className="duration-[660ms] ease-[cubic-bezier(0.65, 0, 0.35, 1)] h-full w-full bg-primary transition-transform"
            style={{ transform: `translateX(-${100 - progress}%)` }}
          />
        </Progress.Root>
        <div className="flex flex-1 overflow-auto">{steps[currentStep]}</div>
      </div>
    </ProgressContext.Provider>
  );
}
