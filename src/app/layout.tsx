import "../styles/global.css";

export const metadata = {
  title: {
    default: "XChange Talent Pool",
    template: "%s | XChange Talent Pool",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
