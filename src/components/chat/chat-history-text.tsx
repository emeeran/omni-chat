import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/lib/utils';

interface ChatHistoryTextProps {
  messages: ChatMessage[];
}

export const ChatHistoryText: React.FC<ChatHistoryTextProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
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

  // Implement virtual scrolling for large message lists
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 20 });
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const itemHeight = 150; // Approximate height of a message pair
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.min(
        Math.ceil((scrollTop + clientHeight) / itemHeight),
        messagePairs.length
      );
      
      setVisibleRange({ start, end });
    };
    
    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messagePairs.length]);

  // Only render visible message pairs
  const visiblePairs = messagePairs.slice(visibleRange.start, visibleRange.end);
  
  // Calculate total height for proper scrolling
  const totalHeight = messagePairs.length * 150; // Approximate height per pair
  const topOffset = visibleRange.start * 150;

  return (
    <div 
      ref={containerRef}
      className="space-y-6 pb-8 h-full overflow-y-auto"
      style={{ position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: topOffset, width: '100%' }}>
          {visiblePairs.map((pair, index) => (
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
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        className="prose dark:prose-invert max-w-none"
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
      </div>
    </div>
  );
}; 