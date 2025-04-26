import { Bot } from 'lucide-react';
import React from 'react';

export function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="p-6 border-b border-primary-100/30 dark:border-primary-900/30 flex justify-center items-center bg-gradient-to-r from-primary-100/40 via-secondary-50/40 to-secondary-100/40 dark:from-primary-900/40 dark:via-secondary-900/40 dark:to-secondary-950/40 rounded-t-3xl animate-gradient-move">
      {!collapsed ? (
        <h1 className="text-2xl font-extrabold tracking-tight text-primary-800 dark:text-primary-100 font-sans drop-shadow-lg" style={{letterSpacing: '0.02em'}}>Omni-Chat</h1>
      ) : (
        <Bot className="w-7 h-7 text-primary-600 dark:text-primary-400 animate-bounce" aria-label="Omni-Chat" />
      )}
    </div>
  );
} 