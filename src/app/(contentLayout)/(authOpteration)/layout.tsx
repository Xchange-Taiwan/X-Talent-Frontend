import CubeImgUrl from '@/assets/auth/Cube.png';

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen py-[120px]">
      {children}
      <div
        className="absolute bottom-0 left-1/2 -z-10 h-80 w-3/4 max-w-[800px] -translate-x-1/2 bg-contain bg-bottom bg-no-repeat"
        style={{ backgroundImage: `url(${CubeImgUrl.src})` }}
      />
    </div>
  );
}
