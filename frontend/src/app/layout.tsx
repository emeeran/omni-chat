import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

// Use optimized font loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'OmniChat - Multi-Provider AI Chat Platform',
  description: 'An enterprise-ready chat platform with support for multiple AI providers',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 min-h-screen transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}