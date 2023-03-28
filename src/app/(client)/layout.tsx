import Layout from "@/components/ClientLayout";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
