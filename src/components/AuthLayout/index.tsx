import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="text-2xl text-center bg-rose-400">Auth Header</header>
      <main className="grow">{children}</main>
      <footer className="text-xl text-center bg-green-200">Auth Footer</footer>
    </div>
  );
};

export default Layout;
