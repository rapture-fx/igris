import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Schlep-engine Documentation',
  description: 'Documentation for Schlep-engine - We handle the schlep so you don\'t have to',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="m-0 p-0">
      <body className="font-inter antialiased m-0 p-0">
        {children}
      </body>
    </html>
  );
}
