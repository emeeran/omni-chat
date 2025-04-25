import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OmniChat - Multi-Provider AI Chat Platform',
  description: 'An enterprise-ready chat platform with support for multiple AI providers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-dark-800 min-h-screen">
        {children}
      </body>
    </html>
  );
} 