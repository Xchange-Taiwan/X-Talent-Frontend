import { FC, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-rose-400 text-center text-2xl">Auth Header</header>
      <main className="grow">{children}</main>
      <footer className="bg-green-200 text-center text-xl">Auth Footer</footer>
    </div>
  );
};

export default Layout;
