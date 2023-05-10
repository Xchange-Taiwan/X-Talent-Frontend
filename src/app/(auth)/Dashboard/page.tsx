'use client';
import { FC } from 'react';
import { signOut } from 'next-auth/react';

const Dashboard: FC = () => {
  return (
    <div className="container mx-auto">
      <div className="text-3xl text-red-600">DashBoard</div>
      <button onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</button>
    </div>
  );
};

export default Dashboard;
