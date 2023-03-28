"use client";

import { signIn, signOut, useSession } from "next-auth/react";

const Home = () => {
  const { status, data: session } = useSession();

  const userInfo = session?.user;

  if (status === "loading") {
    return (
      <div>
        <p>Loading ...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center">
      <h1 className="text-xl text-red-400 mb-4">Landing Page</h1>

      {userInfo ? (
        <div className="flex flex-col justify-center items-center gap-4">
          <p>Signed in as {userInfo?.email || "-"}</p>
          <button className="px-4 py-2 bg-amber-300" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      ) : (
        <button className="px-4 py-2 bg-slate-300" onClick={() => signIn()}>
          SignIn
        </button>
      )}
    </div>
  );
};

export default Home;
