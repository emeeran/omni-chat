import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/lib/utils';

interface ChatHistoryTextProps {
  messages: ChatMessage[];
}

export const ChatHistoryText: React.FC<ChatHistoryTextProps> = ({ messages }) => {
  // Group messages into user-assistant pairs
  const messagePairs = [];
  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    if (userMsg) {
      messagePairs.push({
        user: userMsg,
        assistant: assistantMsg
      });
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {messagePairs.map((pair, index) => (
        <div key={index} className="space-y-4">
          {/* User message */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                Y
              </div>
              <div className="text-sm font-medium text-blue-500">You</div>
              <div className="text-xs text-muted-foreground">
                {new Date(pair.user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="pl-10">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <p className="text-sm">{pair.user.content}</p>
              </div>
            </div>
          </div>

          {/* Assistant message */}
          {pair.assistant && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">
                  A
                </div>
                <div className="text-sm font-medium text-green-500">Assistant</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(pair.assistant.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="pl-10">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: ({ className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return !isInline ? (
                          <div className="relative">
                            <pre className="p-3 rounded-md bg-gray-100 dark:bg-gray-800 overflow-x-auto">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-3">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {pair.assistant.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}; 