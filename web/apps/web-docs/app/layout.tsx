import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Igris Overture Documentation',
  description: 'Documentation for Igris Overture - Intelligent AI routing and optimization platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="m-0 p-0" suppressHydrationWarning>
      <body className="font-inter antialiased m-0 p-0" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
