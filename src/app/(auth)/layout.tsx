import { handler } from '@api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import Layout from '@/components/AuthLayout';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(handler);

  if (!session) {
    redirect('/');
  }

  return <Layout>{children}</Layout>;
}
