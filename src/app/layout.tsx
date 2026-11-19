import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '仲恺校园百事通',
  description: '选择你的校园向导，开启智慧校园生活',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
