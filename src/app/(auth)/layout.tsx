import { redirect } from 'next/navigation';
import Layout from '@/components/AuthLayout';
import { getServerSession } from 'next-auth/next';
import { handler } from '@api/auth/[...nextauth]/route';

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
