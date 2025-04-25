import { useRef, useEffect } from 'react';
import { UserCircle, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '@/lib/api';

type ChatMessagesProps = {
  messages: Message[];
  isLoading?: boolean;
};

export default function ChatMessages({ messages, isLoading = false }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
              <div className={`message-content prose dark:prose-invert max-w-none py-2 px-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-gray-800 dark:text-gray-200' 
                  : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-800 dark:text-gray-200'
              }`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
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