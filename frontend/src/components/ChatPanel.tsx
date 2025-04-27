'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Send, RefreshCw, Bot, User, PanelRight, Bookmark, MoreHorizontal, Check, VolumeX, Volume2, Play, Pause, RotateCcw, Volume } from 'lucide-react';
import { Chat, Message, sendChatMessage } from '@/lib/api';
import ChatMessages from './ChatMessages';
import ReactMarkdown from 'react-markdown';
import { 
  isSpeaking, 
  speakText, 
  stopSpeaking, 
  initSpeechSynthesis, 
  isSpeechSynthesisSupported,
  setUseBackendTTS
} from '@/lib/textToSpeech';

type ChatPanelProps = {
  chat: Chat;
  selectedMessage?: string;
  onUpdateChat: (updatedChat: Chat) => void;
  audioResponse?: boolean;
};

export default function ChatPanel({ chat, selectedMessage, onUpdateChat, audioResponse = false }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioProgressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const estimatedSpeechDurationRef = useRef<{ [key: string]: number }>({});
  const [isPaused, setIsPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [backendTtsAvailable, setBackendTtsAvailable] = useState(true);
  const audioErrorsCountRef = useRef(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  // Initialize speech synthesis on component mount
  useEffect(() => {
    const supported = initSpeechSynthesis();
    setIsSpeechSupported(supported);
    
    // Check if backend TTS is available
    const checkBackendTTS = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000) // 2 second timeout
        });
        
        setBackendTtsAvailable(response.ok);
        setUseBackendTTS(response.ok);
      } catch (error) {
        console.warn('Backend TTS service check failed:', error);
        setBackendTtsAvailable(false);
        setUseBackendTTS(false);
      }
    };
    
    checkBackendTTS();
  }, []);

  // Estimate speech duration based on text length (rough approximation)
  const estimateSpeechDuration = (text: string): number => {
    // Average reading speed is ~150 words per minute, or 2.5 words per second
    // Calculate words by splitting on spaces and counting
    const words = text.trim().split(/\s+/).length;
    // Assign duration in seconds with a minimum of 3 seconds
    return Math.max(3, Math.ceil(words / 2.5));
  };

  // Set up progress timer for speaking animation
  const setupProgressTimer = (messageId: string, text: string) => {
    // Clear any existing timer
    if (audioProgressTimerRef.current) {
      clearInterval(audioProgressTimerRef.current);
    }

    // Estimate duration if we don't have it already
    if (!estimatedSpeechDurationRef.current[messageId]) {
      estimatedSpeechDurationRef.current[messageId] = estimateSpeechDuration(text);
    }
    
    const duration = estimatedSpeechDurationRef.current[messageId];
    const interval = 100; // Update every 100ms
    const steps = (duration * 1000) / interval;
    let currentStep = 0;

    setAudioProgress(0);
    
    // Set up the timer
    audioProgressTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = Math.min(100, Math.floor((currentStep / steps) * 100));
      setAudioProgress(progress);
      
      if (progress >= 100) {
        clearInterval(audioProgressTimerRef.current!);
        audioProgressTimerRef.current = null;
      }
    }, interval);

    // Return a cleanup function
    return () => {
      if (audioProgressTimerRef.current) {
        clearInterval(audioProgressTimerRef.current);
        audioProgressTimerRef.current = null;
      }
    };
  };

  // Custom pagination hook to ensure stable pagination
  const usePagination = (messages: Message[], itemsPerPage = 1) => {
    const [currentPage, setCurrentPage] = useState(0);
    
    // Get all user message indices
    const userIndices = useMemo(() => {
      return messages
        .map((msg: Message, idx: number) => msg.role === 'user' ? idx : -1)
        .filter((idx: number) => idx !== -1);
    }, [messages]);
    
    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(userIndices.length / itemsPerPage));
    
    // Ensure page is in bounds
    useEffect(() => {
      if (currentPage >= totalPages) {
        setCurrentPage(Math.max(0, totalPages - 1));
      }
    }, [currentPage, totalPages]);
    
    // Go to last page when new messages are added
    const prevUserCountRef = useRef(userIndices.length);
    useEffect(() => {
      if (userIndices.length > prevUserCountRef.current) {
        setCurrentPage(Math.max(0, totalPages - 1));
      }
      prevUserCountRef.current = userIndices.length;
    }, [userIndices.length, totalPages]);
    
    // Reset page when chat changes
    useEffect(() => {
      setCurrentPage(0);
    }, [messages[0]?.message_id]);
    
    // Get visible messages for current page
    const getVisiblePairs = () => {
      const start = currentPage * itemsPerPage;
      const end = Math.min(start + itemsPerPage, userIndices.length);
      const pageUserIndices = userIndices.slice(start, end);
      
      return pageUserIndices.map((userIdx: number) => {
        const userMsg = messages[userIdx];
        
        // Find next assistant message
        let assistantMsg: Message | null = null;
        for (let i = userIdx + 1; i < messages.length; i++) {
          if (messages[i].role === 'assistant') {
            assistantMsg = messages[i];
            break;
          }
        }
        
        return { userMsg, assistantMsg };
      });
    };
    
    return {
      currentPage,
      setCurrentPage,
      totalPages,
      visiblePairs: getVisiblePairs(),
      goToNextPage: () => setCurrentPage(Math.min(currentPage + 1, totalPages - 1)),
      goToPrevPage: () => setCurrentPage(Math.max(0, currentPage - 1)),
      goToFirstPage: () => setCurrentPage(0),
      goToLastPage: () => setCurrentPage(Math.max(0, totalPages - 1)),
      hasNextPage: currentPage < totalPages - 1,
      hasPrevPage: currentPage > 0
    };
  };
  
  // Use the pagination hook
  const pagination = usePagination(chat.messages);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (audioProgressTimerRef.current) {
        clearInterval(audioProgressTimerRef.current);
      }
    };
  }, []);

  // Function to speak the latest assistant message when it arrives
  useEffect(() => {
    const speakLatestMessage = async () => {
      // Get the latest assistant message
      const latestAssistantMsg = [...chat.messages]
        .filter(m => m.role === 'assistant')
        .pop();
      
      // If there's a new message, audio is enabled, and we haven't spoken it yet
      if (
        latestAssistantMsg && 
        audioResponse && 
        latestAssistantMsg.message_id !== lastSpokenMessageId &&
        !isLoading
      ) {
        setLastSpokenMessageId(latestAssistantMsg.message_id);
        setIsCurrentlySpeaking(true);
        setIsPaused(false);
        setAudioError(null);
        
        // Set up progress animation
        const cleanup = setupProgressTimer(
          latestAssistantMsg.message_id, 
          latestAssistantMsg.content
        );
        
        try {
          // Speak the text
          const success = await speakText(latestAssistantMsg.content, 'en-US', 1, 1, () => {
            setIsCurrentlySpeaking(false);
            setAudioProgress(0);
            cleanup();
          });
          
          if (!success) {
            audioErrorsCountRef.current += 1;
            if (audioErrorsCountRef.current > 2) {
              setAudioError("Speech synthesis failed. Please try again later.");
            }
          } else {
            audioErrorsCountRef.current = 0;
          }
        } catch (error) {
          console.error('Error in speech synthesis:', error);
          cleanup();
          setIsCurrentlySpeaking(false);
          setAudioError("Speech synthesis error. Using text only.");
          audioErrorsCountRef.current += 1;
        }
      }
    };

    if (isSpeechSupported) {
      speakLatestMessage();
    }
  }, [chat.messages, audioResponse, lastSpokenMessageId, isLoading, isSpeechSupported]);

  // Stop speaking when audioResponse is turned off
  useEffect(() => {
    if (!audioResponse && isCurrentlySpeaking) {
      stopSpeaking();
      setIsCurrentlySpeaking(false);
      setIsPaused(false);
      setAudioProgress(0);
      
      // Clear any timer
      if (audioProgressTimerRef.current) {
        clearInterval(audioProgressTimerRef.current);
        audioProgressTimerRef.current = null;
      }
    }
  }, [audioResponse, isCurrentlySpeaking]);

  // Handle play audio for a specific message
  const handlePlayAudio = useCallback((message: Message) => {
    if (!isSpeechSupported) {
      setAudioError("Speech synthesis is not supported in your browser");
      return;
    }
    
    setAudioError(null);
    
    // If we're currently speaking this message and it's paused, resume it
    if (isCurrentlySpeaking && lastSpokenMessageId === message.message_id && isPaused) {
      // Currently the Web Speech API doesn't support resume, so we'll restart
      // In a production app, we might use a different TTS library that supports pause/resume
      setIsPaused(false);
      
      // Restart progress animation from current position
      const remainingPercentage = 100 - audioProgress;
      const estimatedDuration = estimatedSpeechDurationRef.current[message.message_id] || estimateSpeechDuration(message.content);
      const remainingDuration = (estimatedDuration * remainingPercentage) / 100;
      
      const cleanup = setupProgressTimer(message.message_id, message.content);
      
      // Restart speech
      speakText(message.content, 'en-US', 1, 1, () => {
        setIsCurrentlySpeaking(false);
        setIsPaused(false);
        setAudioProgress(0);
        cleanup();
      }).catch(error => {
        console.error('Error in speech synthesis:', error);
        setAudioError("Speech synthesis failed. Using text only.");
        cleanup();
        setIsCurrentlySpeaking(false);
      });
      return;
    }
    
    // If we're currently speaking something else, stop it
    if (isCurrentlySpeaking) {
      stopSpeaking();
      
      // Clear any timer
      if (audioProgressTimerRef.current) {
        clearInterval(audioProgressTimerRef.current);
        audioProgressTimerRef.current = null;
      }
    }
    
    // Start speaking the new message
    setLastSpokenMessageId(message.message_id);
    setIsCurrentlySpeaking(true);
    setIsPaused(false);
    setAudioProgress(0);
    
    // Set up progress animation
    const cleanup = setupProgressTimer(message.message_id, message.content);
    
    // Speak the text
    speakText(message.content, 'en-US', 1, 1, () => {
      setIsCurrentlySpeaking(false);
      setIsPaused(false);
      setAudioProgress(0);
      cleanup();
    }).catch(error => {
      console.error('Error in speech synthesis:', error);
      setAudioError("Speech synthesis failed. Using text only.");
      cleanup();
      setIsCurrentlySpeaking(false);
    });
  }, [isSpeechSupported, isCurrentlySpeaking, lastSpokenMessageId, isPaused, audioProgress]);

  // Handle pause audio
  const handlePauseAudio = useCallback(() => {
    if (!isSpeechSupported || !isCurrentlySpeaking) return;
    
    // The Web Speech API doesn't support true pause/resume, so we'll just stop
    stopSpeaking();
    setIsPaused(true);
    
    // Stop the progress animation but maintain current progress
    if (audioProgressTimerRef.current) {
      clearInterval(audioProgressTimerRef.current);
      audioProgressTimerRef.current = null;
    }
  }, [isSpeechSupported, isCurrentlySpeaking]);

  // Handle stop/reset audio
  const handleStopAudio = useCallback(() => {
    if (!isSpeechSupported) return;
    
    stopSpeaking();
    setIsCurrentlySpeaking(false);
    setIsPaused(false);
    setAudioProgress(0);
    
    // Clear any timer
    if (audioProgressTimerRef.current) {
      clearInterval(audioProgressTimerRef.current);
      audioProgressTimerRef.current = null;
    }
  }, [isSpeechSupported]);

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

      {audioError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-2 text-amber-700 text-sm fixed top-14 right-0 max-w-md z-50 shadow-lg rounded-l-md m-4 flex items-center justify-between backdrop-blur-sm">
          <span>{audioError} {!backendTtsAvailable && "Using browser TTS instead."}</span>
          <button
            onClick={() => setAudioError(null)}
            className="ml-4 p-1 hover:bg-amber-100 rounded"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      )}

      {/* Chat history paginated container */}
      <div className="flex-1 w-full mx-0 mb-0 p-6 bg-white/80 dark:bg-gray-900/80 rounded-none border-0 shadow-inner overflow-y-auto flex flex-col">
        {chat.messages.length === 0 ? (
          <div className="text-gray-400 text-sm italic flex items-center justify-center h-full">No messages yet.</div>
        ) : (
          <div className="w-full max-w-2xl space-y-8 mx-auto">            
            {/* Render message pairs */}
            {pagination.visiblePairs.length === 0 ? (
              <div className="text-center italic text-gray-500 py-8">
                No messages on this page. <button 
                  onClick={pagination.goToFirstPage} 
                  className="text-blue-600 hover:underline">Go to first page</button>
              </div>
            ) : (
              pagination.visiblePairs.map(({ userMsg, assistantMsg }) => (
                <div key={userMsg.message_id} className="flex flex-col gap-3 bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-lg p-5 border border-gray-100/80 dark:border-gray-700/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
                  {/* User message */}
                  <div className="flex items-start justify-end gap-2">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">User</span>
                        <span className="bg-gradient-to-br from-blue-400 to-indigo-400 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow">U</span>
                      </div>
                      <div className="bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-gray-900 dark:text-blue-100 rounded-xl rounded-br-sm px-4 py-3 max-w-[80vw] break-words shadow-md border border-blue-200/50 dark:border-blue-800/50 animate-fadeIn hover:shadow-lg transition-shadow duration-200">
                        <ReactMarkdown className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-blue-700 dark:prose-headings:text-blue-300 prose-a:text-indigo-600 dark:prose-a:text-indigo-400">{userMsg.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  {/* Assistant message */}
                  <div className="flex items-start justify-start gap-2">
                    <span className="bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow">A</span>
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs text-purple-600 dark:text-purple-300 font-semibold">Assistant</span>
                        
                        {/* Audio controls for assistant responses */}
                        {assistantMsg && isSpeechSupported && (
                          <div className="flex items-center space-x-1">
                            {/* Audio progress bar when playing */}
                            {isCurrentlySpeaking && lastSpokenMessageId === assistantMsg.message_id && (
                              <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mr-1">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-100 ease-linear"
                                  style={{ width: `${audioProgress}%` }}
                                ></div>
                              </div>
                            )}
                            
                            {/* Play button */}
                            {(!isCurrentlySpeaking || lastSpokenMessageId !== assistantMsg.message_id || isPaused) && (
                              <button 
                                onClick={() => handlePlayAudio(assistantMsg)}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-blue-500"
                                title="Play audio"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* Pause button - only show when this message is playing */}
                            {isCurrentlySpeaking && lastSpokenMessageId === assistantMsg.message_id && !isPaused && (
                              <button 
                                onClick={handlePauseAudio}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-blue-500"
                                title="Pause audio"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* Stop/Reset button - only show when this message is playing or paused */}
                            {((isCurrentlySpeaking && lastSpokenMessageId === assistantMsg.message_id) || 
                             (isPaused && lastSpokenMessageId === assistantMsg.message_id)) && (
                              <button 
                                onClick={handleStopAudio}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-red-500"
                                title="Stop audio"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* Audio toggle indicator */}
                            <span className={`text-xs ${audioResponse ? 'text-blue-500' : 'text-gray-400'}`}>
                              <Volume className="w-3 h-3 inline-block mr-1" />
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700/90 dark:to-gray-800 text-gray-900 dark:text-gray-100 rounded-xl rounded-bl-sm px-4 py-3 max-w-[80vw] break-words shadow-md border border-gray-200/50 dark:border-gray-700/50 animate-fadeIn hover:shadow-lg transition-shadow duration-200">
                        {assistantMsg ? (
                          <>
                            <div className="flex items-center mb-2 text-xs text-emerald-600 dark:text-emerald-400">
                              <span className="bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full mr-2">{chat.model.split('/').pop()}</span>
                              {assistantMsg.content.split(' ').length > 2 && 
                                <span className="text-gray-500 dark:text-gray-400">{Math.ceil(assistantMsg.content.length / 5)} chars</span>
                              }
                            </div>
                            <ReactMarkdown 
                              className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-emerald-700 dark:prose-headings:text-emerald-300 prose-a:text-blue-600 dark:prose-a:text-blue-400" 
                            >{assistantMsg.content}</ReactMarkdown>
                          </>
                        ) : (
                          <div className="flex items-center space-x-2 text-gray-400 italic py-2">
                            <div className="animate-pulse flex space-x-2">
                              <div className="h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
                              <div className="h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full animation-delay-200"></div>
                              <div className="h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full animation-delay-500"></div>
                            </div>
                            <span>Assistant is thinking...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Timestamp */}
                  <div className="flex justify-center mt-1.5">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 backdrop-blur-sm shadow-sm">
                      <span className="mr-1.5">{chat.provider}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                      <span className="mx-1.5">{chat.model.split('/').pop()}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                      <span className="ml-1.5">
                        {assistantMsg
                          ? new Date(assistantMsg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                          : new Date(userMsg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Pagination controls */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8 mb-2">
                <button
                  className="flex items-center gap-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg disabled:opacity-60 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200"
                  onClick={pagination.goToPrevPage}
                  disabled={!pagination.hasPrevPage}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <div className="flex items-center justify-center">
                  <span className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-300 font-medium shadow-sm border border-gray-100 dark:border-gray-700">
                    {pagination.currentPage + 1} of {pagination.totalPages}
                  </span>
                </div>
                <button
                  className="flex items-center gap-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg disabled:opacity-60 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200"
                  onClick={pagination.goToNextPage}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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

      <div className="px-4 pb-5 pt-3 bg-gradient-to-t from-white/90 via-white/70 to-transparent dark:from-gray-900/90 dark:via-gray-900/70 dark:to-transparent backdrop-blur-sm">
        <div className="relative mx-auto max-w-3xl">
          <div className="relative rounded-2xl shadow-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-3 animate-fadeIn border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors duration-200">
            <div className="flex items-end space-x-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3.5 pr-12 border border-gray-200/60 dark:border-gray-700/60 focus:border-blue-300 dark:focus:border-blue-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-600/50 focus:border-transparent bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 resize-none transition-all duration-200"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="absolute right-3 bottom-3 text-xs text-gray-400">
                  {inputValue.length > 0 && `${inputValue.length} chars`}
                </div>
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