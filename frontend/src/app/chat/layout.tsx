import { Metadata } from 'next';

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e0f2fe' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'Chat | OmniChat',
  description: 'Chat with OmniChat - Your AI Assistant',
};

// If you have a layout component, export it below. If not, this file can just export the viewport. 

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 