import { useRef, useEffect, useState } from 'react';
import { UserCircle, Bot, Copy, Terminal, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/api';

type ChatMessagesProps = {
  messages: Message[];
  isLoading?: boolean;
  onRunCode?: (code: string, language?: string) => void;
};

export default function ChatMessages({ messages, isLoading = false, onRunCode }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset copy state after 2 seconds
  useEffect(() => {
    if (copiedCode) {
      const timer = setTimeout(() => {
        setCopiedCode(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedCode]);

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
  };

  // Run code in terminal
  const handleRunCode = (code: string, language?: string) => {
    if (onRunCode) {
      onRunCode(code, language);
    }
  };

  // Custom code block renderer to add copy/run buttons
  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const isExecutable = ['bash', 'sh', 'shell', 'python', 'js', 'javascript', 'typescript', 'ts'].includes(language);
    const code = String(children).replace(/\n$/, '');

    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className="relative group">
        <pre className={className} {...props}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
          <button
            onClick={() => handleCopyCode(code)}
            className="p-1.5 rounded bg-gray-700 text-gray-100 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            title="Copy code"
          >
            {copiedCode === code ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {isExecutable && onRunCode && (
            <button
              onClick={() => handleRunCode(code, language)}
              className="p-1.5 rounded bg-primary-600 text-white hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              title="Run code"
            >
              <Terminal size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Skip system messages
  const displayMessages = messages.filter(msg => msg.role !== 'system');

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {displayMessages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Welcome to OmniChat</h2>
          <p className="text-gray-500 max-w-md">
            Start a conversation with AI using multiple providers and models. Customize your experience in the settings.
          </p>
        </div>
      ) : (
        displayMessages.map((message) => (
          <div key={message.message_id} className="flex items-start">
            {message.role === 'user' ? (
              <div className="flex-shrink-0 mr-3">
                <UserCircle className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
            ) : (
              <div className="flex-shrink-0 mr-3">
                <Bot className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium mb-1">
                {message.role === 'user' ? 'You' : 'AI Assistant'}
              </div>
              <div className={`message-content prose dark:prose-invert max-w-none py-2 px-3 rounded-lg ${message.role === 'user'
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-gray-800 dark:text-gray-200'
                  : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-800 dark:text-gray-200'
                }`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: CodeBlock
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            <Bot className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">AI Assistant</div>
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 py-3 px-4">
              <div className="flex space-x-2">
                <div className="h-2 w-2 bg-secondary-500 rounded-full animate-bounce"></div>
                <div className="h-2 w-2 bg-secondary-500 rounded-full animate-bounce delay-150"></div>
                <div className="h-2 w-2 bg-secondary-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}