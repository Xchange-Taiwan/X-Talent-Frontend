export default function DashboardLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      <h1>I am Auth</h1>
      {children}
    </section>
  );
}
