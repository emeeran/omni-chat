'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Send, RefreshCw, Bot, Sparkles, User, PanelRight, Bookmark, MoreHorizontal, Check } from 'lucide-react';
import { Chat, Message, sendChatMessage } from '@/lib/api';
import ChatMessages from './ChatMessages';

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Example message suggestions
  const suggestions = [
    "Explain how large language models work",
    "Write a Python script to analyze sentiment in tweets",
    "Summarize the key features of React 18",
    "What are the best practices for API security?"
  ];

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
      setShowSuggestions(false);

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

  // Use suggestion as input
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion);
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
        content: `<div class="flex items-center space-x-2">
          <div class="animate-pulse">
            <div class="h-2 w-2 bg-blue-500 rounded-full inline-block"></div>
            <div class="h-2 w-2 bg-blue-500 rounded-full inline-block animation-delay-200"></div>
            <div class="h-2 w-2 bg-blue-500 rounded-full inline-block animation-delay-400"></div>
          </div>
          <span>Executing code...</span>
        </div>`,
        created_at: new Date().toISOString(),
      };

      // Update UI with both messages
      const updatedMessages = [...chat.messages, userMessage, assistantMessage];
      onUpdateChat({
        ...chat,
        messages: updatedMessages,
      });

      // Run the code in a terminal via the API
      let command = code;
      let createFileResponse;

      // Wrap the command in the appropriate interpreter if needed
      if (language === 'python') {
        // Create a temp Python file and run it
        const timestamp = Date.now();
        const filename = `temp_script_${timestamp}.py`;

        // First create the file
        createFileResponse = await fetch('/api/terminal/write-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename,
            content: code,
          }),
        });

        if (!createFileResponse.ok) {
          throw new Error('Failed to create temporary script file');
        }

        // Then execute it
        command = `python ${filename}`;
      } else if (language === 'javascript' || language === 'js') {
        // Create a temp JS file and run it
        const timestamp = Date.now();
        const filename = `temp_script_${timestamp}.js`;

        // First create the file
        createFileResponse = await fetch('/api/terminal/write-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename,
            content: code,
          }),
        });

        if (!createFileResponse.ok) {
          throw new Error('Failed to create temporary script file');
        }

        // Then execute it
        command = `node ${filename}`;
      }

      // Execute the command
      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute command');
      }

      const result = await response.json();

      // Update the assistant message with the results
      const outputMessage: Message = {
        message_id: `output-${Date.now()}`,
        role: 'assistant',
        content: `<div class="flex flex-col space-y-2">
          <div class="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4" />
            <span class="font-medium">Code executed successfully</span>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-md p-3 overflow-auto">
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

  // Use memo for empty chat UI to prevent re-renders
  const emptyChatUI = useMemo(() => (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
      <div className="mb-6 p-5 rounded-full bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-400 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-600 shadow-lg animate-float">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <h2 className="text-3xl font-bold mb-3 text-gray-800 dark:text-gray-100 animate-fadeIn bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 inline-block text-transparent bg-clip-text">Start a conversation</h2>
      <p className="text-base text-gray-600 dark:text-gray-300 max-w-md text-center animate-fadeIn mb-8">
        Send a message to start chatting with the AI assistant using {chat.model}.
      </p>

      <div className="w-full max-w-lg mt-4 space-y-3 animate-fadeIn">
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-2">Try one of these examples:</p>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            className="w-full p-3 text-left rounded-xl border border-blue-100 dark:border-blue-900 bg-white/80 dark:bg-gray-800/80 hover:bg-blue-50 dark:hover:bg-blue-900/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 text-gray-800 dark:text-gray-200"
          >
            <div className="flex items-center">
              <span className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-800 mr-3">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              </span>
              {suggestion}
            </div>
          </button>
        ))}
      </div>

      {showFallbackMessage && (
        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl shadow-sm text-sm max-w-md border border-amber-200 dark:border-amber-800">
          <p>The backend API is currently unavailable. You can still use the application with fallback data.</p>
          <button
            className="mt-3 flex items-center justify-center text-amber-700 dark:text-amber-300 hover:underline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            <span>Retry connection</span>
          </button>
        </div>
      )}
    </div>
  ), [chat.model, showFallbackMessage, suggestions, handleSuggestionClick]);

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-300">
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

      {chat.messages.length === 0
        ? emptyChatUI
        : (
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-dark-700 scrollbar-track-transparent animate-fadeIn">
            {chat.messages.map((msg, index) => (
              <div
                key={msg.message_id}
                className={`group flex space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                <div
                  className={`relative max-w-2xl px-5 py-3 ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm'
                    } transition-all duration-200 hover:shadow-md`}
                >
                  <div className="text-sm opacity-0 group-hover:opacity-100 absolute top-0 right-0 -mt-6 flex space-x-1 transition-opacity duration-200">
                    <button className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="prose dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.content }} />
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-md">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )
      }

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
            {showSuggestions && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-10 transition-all duration-200 animate-slideDown">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-700 mb-2">
                  <span>Suggestions</span>
                  <button onClick={() => setShowSuggestions(false)} className="hover:text-gray-700 dark:hover:text-gray-200">✕</button>
                </div>
                <div className="space-y-1.5">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-sm text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
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

            <div className="flex justify-between items-center px-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></div>
                <span>Using {chat.provider} / {chat.model}</span>
              </div>
              <div className="flex space-x-2">
                <button className="hover:text-gray-700 dark:hover:text-gray-200">
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}