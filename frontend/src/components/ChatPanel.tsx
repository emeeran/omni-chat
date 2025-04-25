'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  // Check API connectivity on mount and set up periodic checks
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000) // Timeout after 2 seconds
        });
        if (response.ok) {
          setErrorMessage(null);
          setShowFallbackMessage(false);
        } else {
          setShowFallbackMessage(true);
        }
      } catch (error) {
        console.error('Error checking API status:', error);
        setShowFallbackMessage(true);
      }
    };

    // Check immediately
    checkApiStatus();

    // Then check every 30 seconds
    const intervalId = setInterval(checkApiStatus, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        role: 'user',
        content: inputValue,
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
          inputValue,
          chat.chat_id,
          chat.provider,
          chat.model,
          chat.system_prompt
        );

        // Update with the API response
        onUpdateChat(response);
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle running code from code blocks
  const handleRunCode = async (code: string, language?: string) => {
    try {
      // If no language is specified, try to infer it from the first line
      // (e.g., "#!/bin/bash" or "#!/usr/bin/env python")
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
        content: `Executing the code...`,
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

      // Wrap the command in the appropriate interpreter if needed
      if (language === 'python') {
        // Create a temp Python file and run it
        const timestamp = Date.now();
        const filename = `temp_script_${timestamp}.py`;

        // First create the file
        const createFileResponse = await fetch('/api/terminal/write-file', {
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
        const createFileResponse = await fetch('/api/terminal/write-file', {
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
        content: `**Code execution result:**\n\`\`\`\n${result.output || 'Command executed successfully with no output.'}\n\`\`\``,
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
        content: `**Error executing code:**\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error occurred'}\n\`\`\``,
        created_at: new Date().toISOString(),
      };

      // Add the error message to the chat
      onUpdateChat({
        ...chat,
        messages: [...chat.messages, errorOutput],
      });
    }
  };

  return (
    <div className="relative flex flex-col h-full">
      {showFallbackMessage && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-2 text-amber-700 text-sm fixed top-0 right-0 max-w-md z-50 shadow-md m-4 flex items-center justify-between">
          <span>Using fallback mode - Backend API is unavailable</span>
          <button
            onClick={() => setShowFallbackMessage(false)}
            className="ml-4 p-1 hover:bg-amber-100 rounded"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      )}

      {chat.messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-4 p-4 rounded-full bg-primary-50 dark:bg-primary-900/20">
              <MessageSquare className="w-8 h-8 text-primary-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              Send a message to start chatting with the AI assistant using {chat.model}.
            </p>
            {showFallbackMessage && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-md text-sm max-w-md">
                <p>The backend API is currently unavailable. You can still use the application with fallback data.</p>
                <button
                  className="mt-2 flex items-center justify-center text-amber-700 dark:text-amber-300 hover:underline"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  <span>Retry connection</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={chat.messages}
          isLoading={isLoading}
          onRunCode={handleRunCode}
        />
      )}

      {errorMessage && (
        <div className="mx-4 mb-2 p-2 bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200 text-sm rounded flex justify-between items-center">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-2 p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800 rounded-full"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 dark:border-dark-700">
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            className={`absolute right-2 bottom-2 p-2 rounded-md ${isLoading || !inputValue.trim()
                ? 'bg-gray-300 dark:bg-dark-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600 text-white'
              }`}
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>
        {showFallbackMessage && (
          <div className="mt-2 text-xs text-right">
            <button
              onClick={() => window.location.reload()}
              className="text-primary-500 hover:text-primary-600 dark:text-primary-400 flex items-center justify-end ml-auto"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              <span>Retry connection</span>
            </button>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}