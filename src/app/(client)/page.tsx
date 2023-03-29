'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

const Home = () => {
  const { status, data: session } = useSession();

  const userInfo = session?.user;

  if (status === 'loading') {
    return (
      <div>
        <p>Loading ...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="mb-4 text-xl text-red-400">Landing Page</h1>

      {userInfo ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <p>Signed in as {userInfo?.email || '-'}</p>
          <button className="bg-amber-300 px-4 py-2" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      ) : (
        <button className="bg-slate-300 px-4 py-2" onClick={() => signIn()}>
          SignIn
        </button>
      )}
    </div>
  );
};

export default Home;
