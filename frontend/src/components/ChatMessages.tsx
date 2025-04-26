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
        code: CodeBlock
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
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <pre
        className={className}
        {...props}
        data-language={languageLabel}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
        <button
          onClick={handleCopyCode}
          className="p-1.5 rounded bg-gray-700 text-gray-100 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          title="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {isExecutable && props.onRunCode && (
          <button
            onClick={handleRunCode}
            className="p-1.5 rounded bg-primary-600 text-white hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Run code"
          >
            <Terminal size={14} />
          </button>
        )}
      </div>
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