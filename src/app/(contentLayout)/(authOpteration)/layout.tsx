import CubeImgUrl from '@/assets/auth/Cube.png';

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <div
        className="absolute bottom-0 left-1/2 -z-10 hidden h-80 w-3/4 max-w-[800px] -translate-x-1/2 bg-contain bg-bottom bg-no-repeat sm:block"
        style={{ backgroundImage: `url(${CubeImgUrl.src})` }}
      />
    </div>
  );
}
