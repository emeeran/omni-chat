import { Sparkles, Bot, Cpu } from 'lucide-react';
import React from 'react';

export function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`${collapsed ? 'py-4' : 'py-6'} border-b border-gray-200 dark:border-gray-700 flex justify-center items-center bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20`}>
      {!collapsed ? (
        <div className="flex flex-col items-center">
          <div className="relative mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" aria-label="OmniChat" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="text-center mx-auto">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">OmniChat</h1>
            <div className="flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1"></div>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Assistant</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md animate-pulse-slow">
            <Bot className="w-5 h-5 text-white" aria-label="OmniChat" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}