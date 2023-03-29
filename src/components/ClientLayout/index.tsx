import { FC, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-sky-400 text-center text-2xl">Client Header</header>
      <main className="grow">{children}</main>
      <footer className="bg-orange-200 text-center text-xl">
        Client Footer
      </footer>
    </div>
  );
};

export default Layout;
