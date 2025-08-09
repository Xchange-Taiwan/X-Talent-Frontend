import ReservationTabs from './reservationTabs';

export default function ReservationPresentation() {
  return (
    <div className="flex  min-h-screen justify-center ">
      <div className="w-full max-w-[90%] overflow-hidden rounded-2xl md:max-w-[800px]">
        <div className="font-roboto mx-auto mb-6 h-[42px] w-[251px] text-center text-[36px] font-semibold leading-[100%] tracking-[0%] text-[#1D1B20]">
          我的預約
        </div>
        <ReservationTabs />
      </div>
    </div>
  );
}
