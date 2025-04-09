import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { ChatMessage } from '@/types/chat';
import type { Components } from 'react-markdown';

interface ChatHistoryTextProps {
  messages: ChatMessage[];
}

export function ChatHistoryText({ messages }: ChatHistoryTextProps) {
  // Convert messages to markdown format
  const markdownContent = messages.map((msg, index) => {
    const timestamp = format(new Date(msg.createdAt), 'HH:mm:ss');
    const isUser = msg.role === 'user';
    
    // Format user queries and assistant responses differently
    if (isUser) {
      return `\n### 🗣️ Query [${timestamp}]\n\n${msg.content}\n`;
    } else {
      return `\n#### 🤖 Answer\n\n${msg.content}\n\n---\n`;
    }
  }).join('\n');

  const components: Components = {
    // Style code blocks
    code({ node, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      return isInline ? (
        <code className="bg-muted px-1.5 py-0.5 rounded-sm" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-muted p-4 rounded-md overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    // Style headings
    h3: ({ children }) => (
      <h3 className="text-primary font-semibold border-l-4 border-primary pl-3 py-1">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-green-500 dark:text-green-400 font-medium pl-3">
        {children}
      </h4>
    ),
    // Style paragraphs
    p: ({ children }) => (
      <p className="my-2 leading-relaxed">
        {children}
      </p>
    ),
    // Style horizontal rules
    hr: () => (
      <hr className="my-6 border-t border-border opacity-30" />
    ),
    // Style links
    a: ({ children, href }) => (
      <a 
        href={href}
        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    // Style lists
    ul: ({ children }) => (
      <ul className="list-disc pl-6 my-2 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 my-2 space-y-1">
        {children}
      </ol>
    ),
    // Style blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-muted pl-4 italic my-4">
        {children}
      </blockquote>
    ),
    // Style tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-border">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 bg-muted font-semibold text-left">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-t border-border">
        {children}
      </td>
    ),
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 rounded-lg bg-card">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
} 