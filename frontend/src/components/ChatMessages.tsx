import { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { UserCircle, Bot, Copy, Terminal, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/api';
import { useInView } from 'react-intersection-observer';

type ChatMessagesProps = {
  messages: Message[];
  isLoading?: boolean;
  onRunCode?: (code: string, language?: string) => void;
};

// Memoize individual message rendering to prevent unnecessary re-renders
const MessageContent = memo(({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: CodeBlock,
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => (
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-4">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

MessageContent.displayName = 'MessageContent';

// Create a separate component for code blocks to improve performance
const CodeBlock = memo(function CodeBlock({ node, inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const isExecutable = ['bash', 'sh', 'shell', 'python', 'js', 'javascript', 'typescript', 'ts'].includes(language);
  const code = String(children).replace(/\n$/, '');

  const languageLabel = language ? language : 'text';

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
    });
  }, [code]);

  const handleRunCode = useCallback(() => {
    if (props.onRunCode) {
      props.onRunCode(code, language);
    }
  }, [code, language, props]);

  if (inline) {
    return (
      <code className={`${className} bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm`} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <div className="absolute right-4 top-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {isExecutable && (
          <button
            onClick={handleRunCode}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Run code"
          >
            <Terminal className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleCopyCode}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Copy code"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-t-lg px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-mono">{languageLabel}</span>
      </div>
      <pre className={`${className} m-0 rounded-t-none`} {...props}>
        <code className={`${className} block p-4 overflow-x-auto`}>
          {children}
        </code>
      </pre>
    </div>
  );
});

// Single message component to optimize rendering
const ChatMessage = memo(function ChatMessage({
  message,
  onRunCode,
}: {
  message: Message;
  onRunCode?: (code: string, language?: string) => void;
}) {
  // Use intersection observer to only render complex markdown when message is visible
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  // For very long messages, use a simpler preview when not in view
  const isLongMessage = message.content.length > 1000;

  return (
    <div ref={ref} className="flex items-start group animate-fadeIn">
      {message.role === 'user' ? (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm">
            <UserCircle className="w-5 h-5" />
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center mb-1">
          <div className="text-sm font-medium">
            {message.role === 'user' ? 'You' : 'AI Assistant'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
        <div className={`message-content prose dark:prose-invert max-w-none py-3 px-4 rounded-lg shadow-sm ${message.role === 'user'
            ? 'bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-200 dark:border-indigo-900 dark:from-indigo-900/20 dark:to-blue-900/20'
            : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
          }`}>
          {(!isLongMessage || inView) ? (
            <MessageContent content={message.content} />
          ) : (
            // Simple preview for long messages that are not in view
            <div className="opacity-70">
              {message.content.slice(0, 100)}...
              <span className="text-blue-500 italic ml-2">(scrolling to view)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Loading indicator component
const LoadingIndicator = memo(function LoadingIndicator() {
  return (
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
  );
});

// Welcome screen component
const WelcomeScreen = memo(function WelcomeScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Welcome to OmniChat</h2>
      <p className="text-gray-500 max-w-md">
        Start a conversation with AI using multiple providers and models. Customize your experience in the settings.
      </p>
    </div>
  );
});

// Windowing for large message lists - implement virtualized rendering for chats with many messages
const ChatMessages = memo(function ChatMessages({ messages, isLoading = false, onRunCode }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Skip system messages and implement windowing
  const displayMessages = useMemo(
    () => messages.filter(msg => msg.role !== 'system'),
    [messages]
  );

  // Only render a subset of messages if there are more than 50
  const MAX_RENDERED_MESSAGES = 50;
  const hasExcessMessages = displayMessages.length > MAX_RENDERED_MESSAGES;

  // Show most recent messages, with indicator if messages are hidden
  const visibleMessages = useMemo(() => {
    if (!hasExcessMessages) return displayMessages;
    return displayMessages.slice(-MAX_RENDERED_MESSAGES);
  }, [displayMessages, hasExcessMessages]);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    // Use requestAnimationFrame for smoother scrolling and to ensure DOM is ready
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages, isLoading]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-6">
      {displayMessages.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <>
          {/* Show message indicating hidden history */}
          {hasExcessMessages && (
            <div className="text-center py-2 text-sm text-gray-500 bg-gray-100 dark:bg-dark-700 dark:text-gray-400 rounded-md">
              {displayMessages.length - MAX_RENDERED_MESSAGES} earlier messages not shown
            </div>
          )}

          {/* Visible messages */}
          {visibleMessages.map((message) => (
            <ChatMessage
              key={message.message_id || `${message.role}-${message.timestamp || Date.now()}`}
              message={message}
              onRunCode={onRunCode}
            />
          ))}
        </>
      )}

      {isLoading && <LoadingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
});

export default ChatMessages;