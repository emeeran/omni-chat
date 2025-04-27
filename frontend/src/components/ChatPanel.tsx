'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Send, RefreshCw, Bot, User, PanelRight, Bookmark, MoreHorizontal, Check } from 'lucide-react';
import { Chat, Message, sendChatMessage } from '@/lib/api';
import ChatMessages from './ChatMessages';
import ReactMarkdown from 'react-markdown';

type ChatPanelProps = {
  chat: Chat;
  selectedMessage?: string;
  onUpdateChat: (updatedChat: Chat) => void;
};

export default function ChatPanel({ chat, selectedMessage, onUpdateChat }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const PAIRS_PER_PAGE = 1;

  // Memoize scrollToBottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, scrollToBottom]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  // Auto-scroll chat history container to bottom when messages change
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chat.messages]);

  // Check API connectivity with debounce
  useEffect(() => {
    let isMounted = true;

    const checkApiStatus = async () => {
      if (!isMounted) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch('/api/health', {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (isMounted) {
          if (response.ok) {
            setErrorMessage(null);
            setShowFallbackMessage(false);
          } else {
            setShowFallbackMessage(true);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error checking API status:', error);
          setShowFallbackMessage(true);
        }
      }
    };

    // Check immediately
    checkApiStatus();

    // Then check every 30 seconds
    const intervalId = setInterval(checkApiStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Memoize handleSendMessage to avoid unnecessary recreations
  const handleSendMessage = useCallback(async (message = inputValue) => {
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      // Update UI immediately with user message
      const updatedMessages = [...chat.messages, userMessage];
      onUpdateChat({
        ...chat,
        messages: updatedMessages,
      });

      setInputValue('');

      try {
        // Attempt to send the message to the API
        const response = await sendChatMessage(
          message,
          chat.chat_id,
          chat.provider,
          chat.model,
          chat.system_prompt
        );

        // Update with the API response
        onUpdateChat({
          ...response,
          title: response.title ?? '', // Ensure title is always a string
        });
        setShowFallbackMessage(false);
      } catch (error) {
        console.error('Failed to send message to API:', error);

        // Create a fallback assistant response
        const assistantMessage: Message = {
          message_id: `fallback-${Date.now()}`,
          role: 'assistant',
          content: 'I apologize, but I cannot process your request at the moment as the backend API is unavailable. Your message has been saved locally. You can continue chatting with limited functionality.',
          created_at: new Date().toISOString(),
        };

        // Update with the fallback message
        onUpdateChat({
          ...chat,
          messages: [...updatedMessages, assistantMessage],
        });

        setShowFallbackMessage(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage('An error occurred while sending your message.');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, chat, onUpdateChat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle running code from code blocks
  const handleRunCode = useCallback(async (code: string, language?: string) => {
    try {
      // If no language is specified, try to infer it from the first line
      if (!language && code.startsWith('#!')) {
        const firstLine = code.split('\n')[0].toLowerCase();
        if (firstLine.includes('bash') || firstLine.includes('sh')) {
          language = 'bash';
        } else if (firstLine.includes('python')) {
          language = 'python';
        } else if (firstLine.includes('node')) {
          language = 'javascript';
        }
      }

      // Create a user message showing the code being run
      const userMessage: Message = {
        message_id: `code-${Date.now()}`,
        role: 'user',
        content: `Running code: \`\`\`${language || ''}\n${code}\n\`\`\``,
        created_at: new Date().toISOString(),
      };

      // Create an assistant message saying that the code is being executed
      const assistantMessage: Message = {
        message_id: `exec-${Date.now()}`,
        role: 'assistant',
        content: 'Executing code...',
        created_at: new Date().toISOString(),
      };

      // Update the chat with the messages
      onUpdateChat({
        ...chat,
        messages: [...chat.messages, userMessage, assistantMessage],
      });

      // Call the API to execute the code
      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      const result = await response.json();

      // Create a message with the output
      const outputMessage: Message = {
        message_id: `output-${Date.now()}`,
        role: 'assistant',
        content: `<div class="flex flex-col space-y-2">
          <div class="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
            <span class="font-medium">Code execution result:</span>
          </div>
          <div class="bg-gray-50 dark:bg-gray-900 rounded-md p-3 overflow-auto">
            <pre class="whitespace-pre-wrap">${result.output || 'Command executed with no output.'}</pre>
          </div>
        </div>`,
        created_at: new Date().toISOString(),
      };

      // Replace the "executing" message with the actual output
      const finalMessages = chat.messages.filter(m => m.message_id !== assistantMessage.message_id);
      finalMessages.push(userMessage);
      finalMessages.push(outputMessage);

      onUpdateChat({
        ...chat,
        messages: finalMessages,
      });

    } catch (error) {
      console.error('Error executing code:', error);

      // Create an error message
      const errorOutput: Message = {
        message_id: `error-${Date.now()}`,
        role: 'assistant',
        content: `<div class="flex flex-col space-y-2">
          <div class="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <span class="font-medium">Error executing code</span>
          </div>
          <div class="bg-red-50 dark:bg-red-900/20 rounded-md p-3 overflow-auto">
            <pre class="whitespace-pre-wrap text-red-800 dark:text-red-200">${error instanceof Error ? error.message : 'Unknown error occurred'}</pre>
          </div>
        </div>`,
        created_at: new Date().toISOString(),
      };

      // Add the error message to the chat
      onUpdateChat({
        ...chat,
        messages: [...chat.messages, errorOutput],
      });
    }
  }, [chat, onUpdateChat]);

  // Group messages into user/assistant pairs
  const pairs = [];
  for (let i = 0; i < chat.messages.length; i++) {
    if (chat.messages[i].role === 'user') {
      const userMsg = chat.messages[i];
      const assistantMsg = chat.messages[i + 1] && chat.messages[i + 1].role === 'assistant' ? chat.messages[i + 1] : null;
      pairs.push({ user: userMsg, assistant: assistantMsg });
      if (assistantMsg) i++; // skip assistant in next loop
    }
  }

  // Pagination logic
  const totalPages = Math.ceil(pairs.length / PAIRS_PER_PAGE);
  const paginatedPairs = pairs.slice(page * PAIRS_PER_PAGE, (page + 1) * PAIRS_PER_PAGE);

  // Robust pagination: always keep page in bounds, jump to last page on new pair, and reset on new chat
  const prevPairsLengthRef = useRef(pairs.length);
  useEffect(() => {
    let newPage = page;

    // If chat changes, reset to first page
    if (chat.chat_id && prevPairsLengthRef.current === 0 && pairs.length > 0) {
      newPage = 0;
    }

    // If pairs increased, jump to last page
    if (pairs.length > prevPairsLengthRef.current) {
      newPage = Math.max(0, totalPages - 1);
    }

    // Clamp page to valid range
    if (newPage > totalPages - 1) {
      newPage = Math.max(0, totalPages - 1);
    }
    if (newPage < 0) {
      newPage = 0;
    }

    if (newPage !== page) {
      setPage(newPage);
    }

    prevPairsLengthRef.current = pairs.length;
    // eslint-disable-next-line
  }, [pairs.length, totalPages, page, chat.chat_id]);

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-300">
      {showFallbackMessage && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-2 text-amber-700 text-sm fixed top-0 right-0 max-w-md z-50 shadow-lg rounded-l-md m-4 flex items-center justify-between backdrop-blur-sm">
          <span>Using fallback mode - Backend API is unavailable</span>
          <button
            onClick={() => setShowFallbackMessage(false)}
            className="ml-4 p-1 hover:bg-amber-100 rounded"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      )}

      {/* Chat history paginated container */}
      <div className="flex-1 w-full mx-0 mb-0 p-6 bg-white/80 dark:bg-gray-900/80 rounded-none border-0 shadow-inner overflow-y-auto flex flex-col">
        {pairs.length === 0 ? (
          <div className="text-gray-400 text-sm italic flex items-center justify-center h-full">No messages yet.</div>
        ) : (
          <div className="w-full max-w-2xl space-y-8">
            {paginatedPairs.map((pair, idx) => (
              <div key={pair.user?.message_id || idx} className="flex flex-col gap-2 bg-white dark:bg-gray-800/70 rounded-2xl shadow-md p-4">
                {/* User message */}
                <div className="flex items-start justify-end gap-2">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-blue-600 font-semibold">User</span>
                      <span className="bg-gradient-to-br from-blue-400 to-indigo-400 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow">U</span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/40 text-gray-900 dark:text-blue-100 rounded-xl rounded-br-sm px-4 py-2 max-w-[80vw] break-words shadow-sm">
                      <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none">{pair.user?.content || ''}</ReactMarkdown>
                    </div>
                  </div>
                </div>
                {/* Assistant message */}
                <div className="flex items-start justify-start gap-2">
                  <span className="bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow">A</span>
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-purple-600 dark:text-purple-300 font-semibold mb-1">Assistant</span>
                    <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl rounded-bl-sm px-4 py-2 max-w-[80vw] break-words shadow-sm">
                      {pair.assistant ? (
                        <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none">{pair.assistant.content}</ReactMarkdown>
                      ) : (
                        <span className="italic text-gray-400">...</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Timestamp */}
                <div className="flex justify-center mt-2">
                  <span className="block text-xs text-gray-400 font-mono select-none">
                    {pair.assistant
                      ? `-------------------time-stamp ${new Date(pair.assistant.created_at).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} --------------------`
                      : pair.user
                        ? `-------------------time-stamp ${new Date(pair.user.created_at).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} --------------------`
                        : ''}
                  </span>
                </div>
              </div>
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between mt-6">
                <button
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  {'<<<Previsouse Page'}
                </button>
                <span className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400 self-center" style={{letterSpacing: '0.1em'}}></span>
                <button
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  {'Next Page >>>>>>'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200 text-sm rounded-lg flex justify-between items-center shadow-md backdrop-blur-sm">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded-full"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-white/80 via-white/60 to-transparent dark:from-gray-900/80 dark:via-gray-900/60 dark:to-transparent backdrop-blur-sm">
        <div className="relative mx-auto max-w-3xl">
          <div className="relative rounded-2xl shadow-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-2 animate-fadeIn border border-gray-100 dark:border-gray-700">
            <div className="flex items-end space-x-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3.5 pr-12 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 resize-none transition-all duration-200"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleSendMessage()}
                className={`p-3.5 rounded-xl ${isLoading || !inputValue.trim()
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                  } transition-all duration-200`}
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}