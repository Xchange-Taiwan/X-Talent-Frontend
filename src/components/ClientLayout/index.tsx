import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="text-2xl text-center bg-sky-400">Client Header</header>
      <main className="grow">{children}</main>
      <footer className="text-xl text-center bg-orange-200">
        Client Footer
      </footer>
    </div>
  );
};

export default Layout;
