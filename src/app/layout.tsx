import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/lib/providers/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Omni Chat - Multi-Modal AI Chat Application',
    description: 'A robust chat application using Vercel AI SDK with ultra-modern UI/UX.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider defaultTheme="system">
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}