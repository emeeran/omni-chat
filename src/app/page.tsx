'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '@/components/chat/message';
import { ChatInput } from '@/components/chat/chat-input';
import { ModeSelector } from '@/components/chat/mode-selector';
import { ProviderSelector } from '@/components/chat/provider-selector';
import { FileUpload } from '@/components/chat/file-upload';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChatMessage, ChatMode, Provider } from '@/lib/utils';
import { Cog6ToothIcon, ArrowPathIcon, PlusIcon, BookmarkIcon, FolderOpenIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { CustomChatSDK } from '../lib/custom-chat-sdk';
import { ChatHistoryText } from '@/components/chat/chat-history-text';

// Interface for chat session
interface ChatSession {
    id: string;
    title: string;
    createdAt: Date;
    messages: ChatMessage[];
    mode: ChatMode;
    provider: Provider;
    model?: string;
    persona?: string;
    temperature?: number;
    maxTokens?: number;
    fileData?: {
        name: string;
        type: string;
        size: number;
    };
}

// Create a fresh SDK instance
const sdk = new CustomChatSDK();
sdk.init();

// Extract chat session management to a custom hook
function useChatSessions() {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    
    // Load chat sessions from localStorage on initial load
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('chatSessions');
            if (savedSessions) {
                const parsed = JSON.parse(savedSessions);
                setChatSessions(parsed);
                
                // Set active chat to the most recent one
                if (parsed.length > 0) {
                    setActiveChatId(parsed[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading chat sessions:', error);
        }
    }, []);
    
    // Save chat sessions to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
        } catch (error) {
            console.error('Error saving chat sessions:', error);
        }
    }, [chatSessions]);
    
    // Get active chat with memoization
    const activeChat = useMemo(() => {
        if (!activeChatId) return null;
        return chatSessions.find(chat => chat.id === activeChatId) || null;
    }, [activeChatId, chatSessions]);
    
    // Create a new chat
    const createChat = useCallback((title: string, initialMessage?: ChatMessage) => {
        const newChat: ChatSession = {
            id: uuidv4(),
            title,
            createdAt: new Date(),
            messages: initialMessage ? [initialMessage] : [],
            mode: 'default',
            provider: 'groq',
            model: '',
            persona: 'default',
            temperature: 0.7,
            maxTokens: 1000
        };
        
        setChatSessions(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        return newChat.id;
    }, []);
    
    // Update a chat
    const updateChat = useCallback((chatId: string, updates: Partial<ChatSession>) => {
        setChatSessions(prev => 
            prev.map(session => 
                session.id === chatId ? { ...session, ...updates } : session
            )
        );
    }, []);
    
    // Delete a chat
    const deleteChat = useCallback((chatId: string) => {
        setChatSessions(prev => prev.filter(chat => chat.id !== chatId));
        if (activeChatId === chatId) {
            setActiveChatId(null);
        }
    }, [activeChatId]);
    
    // Add a message to a chat
    const addMessage = useCallback((chatId: string, message: ChatMessage) => {
        setChatSessions(prev => 
            prev.map(session => 
                session.id === chatId 
                    ? { 
                        ...session, 
                        messages: [...session.messages, message],
                        title: session.messages.length === 0 
                            ? (message.content.length > 30 
                                ? `${message.content.substring(0, 30)}...` 
                                : message.content)
                            : session.title
                    } 
                    : session
            )
        );
    }, []);
    
    return {
        activeChatId,
        setActiveChatId,
        chatSessions,
        setChatSessions,
        activeChat,
        createChat,
        updateChat,
        deleteChat,
        addMessage
    };
}

// Extract settings management to a custom hook
function useSettings() {
    const [mode, setMode] = useState<ChatMode>('default');
    const [provider, setProvider] = useState<Provider>('groq');
    const [model, setModel] = useState<string>('');
    const [persona, setPersona] = useState<string>('default');
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(1000);
    const [textSize, setTextSize] = useState('medium');
    
    // Load settings from localStorage on initial load
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('chatSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                setMode(parsed.mode || 'default');
                setProvider(parsed.provider || 'groq');
                setModel(parsed.model || '');
                setPersona(parsed.persona || 'default');
                setTemperature(parsed.temperature || 0.7);
                setMaxTokens(parsed.maxTokens || 1000);
                setTextSize(parsed.textSize || 'medium');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }, []);
    
    // Save settings to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem('chatSettings', JSON.stringify({
                mode,
                provider,
                model,
                persona,
                temperature,
                maxTokens,
                textSize
            }));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }, [mode, provider, model, persona, temperature, maxTokens, textSize]);
    
    return {
        mode,
        setMode,
        provider,
        setProvider,
        model,
        setModel,
        persona,
        setPersona,
        temperature,
        setTemperature,
        maxTokens,
        setMaxTokens,
        textSize,
        setTextSize
    };
}

export default function Home() {
    // Use custom hooks for state management
    const {
        activeChatId,
        setActiveChatId,
        chatSessions,
        activeChat,
        createChat,
        updateChat,
        deleteChat,
        addMessage
    } = useChatSessions();
    
    const {
        mode,
        setMode,
        provider,
        setProvider,
        model,
        setModel,
        persona,
        setPersona,
        temperature,
        setTemperature,
        maxTokens,
        setMaxTokens,
        textSize,
        setTextSize
    } = useSettings();
    
    // State for UI toggles
    const [showSettings, setShowSettings] = useState(false);
    
    // State for file upload
    const [currentFile, setCurrentFile] = useState<File | null>(null);
    
    // Ref for scrolling to bottom of chat
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // State for message input and loading
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChat?.messages]);
    
    // Function to handle message submission - optimized version
    const handleMessageSubmit = async (content: string, currentMode: ChatMode) => {
        // Prevent empty submissions or duplicate submissions during loading
        if (!content.trim() || isLoading) return;
        
        console.log("Submitting message:", content);
        setIsLoading(true);
        
        let chatId = activeChatId;
        
        try {
            // Create user message
            const userMsg: ChatMessage = {
                id: uuidv4(),
                role: 'user' as const,
                content: content,
                createdAt: new Date(),
                mode: currentMode,
                provider,
            };
            
            // If no active chat, create one
            if (!chatId) {
                chatId = createChat(
                    content.length > 30 ? `${content.substring(0, 30)}...` : content,
                    userMsg
                );
            } else {
                // Add message to existing chat
                addMessage(chatId, userMsg);
            }
            
            // Clear input field after submission
            setInput('');
            
            // Generate a response
            const response = await sdk.generateResponse(content, {
                mode: activeChat?.mode || mode,
                provider: activeChat?.provider || provider,
                model: activeChat?.model || model,
                persona: activeChat?.persona || persona,
                temperature: activeChat?.temperature || temperature,
                maxTokens: activeChat?.maxTokens || maxTokens,
                fileData: activeChat?.fileData,
            });
            
            console.log("Model response:", response);
            
            const assistantMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant' as const,
                content: response,
                createdAt: new Date(),
                mode: activeChat?.mode || mode,
                provider: activeChat?.provider || provider,
            };
            
            // Add assistant message to chat
            addMessage(chatId, assistantMsg);
        } catch (error) {
            console.error("Error generating response:", error);
            // Add error message to chat
            const errorMsg: ChatMessage = {
                id: uuidv4(),
                role: 'assistant' as const,
                content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
                createdAt: new Date(),
                mode: activeChat?.mode || mode,
                provider: activeChat?.provider || provider,
            };
            
            // Add error message to chat
            if (chatId) {
                addMessage(chatId, errorMsg);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    // Function to handle retry (regenerate last response)
    const handleRetry = useCallback(() => {
        if (!activeChat || activeChat.messages.length < 2) return;
        
        // Remove the last assistant message
        updateChat(activeChatId!, {
            messages: activeChat.messages.slice(0, -1)
        });
        
        // Get user messages for AI resubmission
        const userMessages = activeChat.messages.filter(msg => msg.role === 'user');
        if (userMessages.length > 0) {
            // Set current messages and re-submit the last user message
            const lastUserMsg = userMessages[userMessages.length - 1];
            
            setTimeout(() => {
                // Trigger submission with the last user message
                handleMessageSubmit(lastUserMsg.content, activeChat?.mode || mode);
            }, 100);
        }
    }, [activeChat, activeChatId, handleMessageSubmit, mode, updateChat]);
    
    // Function to handle new chat
    const handleNewChat = useCallback(() => {
        createChat('New Chat');
    }, [createChat]);
    
    // Function to handle save chat
    const handleSaveChat = useCallback(() => {
        if (!activeChat) return;
        // In a real app, this would save to a database or local storage
        alert('Chat saved! In a production app, this would save to a database.');
    }, [activeChat]);
    
    // Function to handle load chat
    const handleLoadChat = useCallback(() => {
        // In a real app, this would load from a database or local storage
        alert('In a production app, this would open a dialog to load a saved chat.');
    }, []);
    
    // Function to handle export chat
    const handleExportChat = useCallback(() => {
        if (!activeChat) return;
        
        const chatData = JSON.stringify(activeChat, null, 2);
        const blob = new Blob([chatData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeChat.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [activeChat]);
    
    // Function to handle file upload
    const handleFileUpload = useCallback((file: File) => {
        setCurrentFile(file);
        
        // Update the active chat with file data
        if (activeChatId) {
            updateChat(activeChatId, {
                fileData: {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                }
            });
        }
    }, [activeChatId, updateChat]);
    
    // Function to handle mode change
    const handleModeChange = useCallback((newMode: ChatMode) => {
        setMode(newMode);
        
        // Update mode for active chat if one exists
        if (activeChatId) {
            updateChat(activeChatId, { mode: newMode });
        }
        
        // Reset file when changing mode
        setCurrentFile(null);
    }, [activeChatId, setMode, updateChat]);
    
    // Function to handle provider change
    const handleProviderChange = useCallback((newProvider: Provider) => {
        setProvider(newProvider);
        
        // Update provider for active chat if one exists
        if (activeChatId) {
            updateChat(activeChatId, { provider: newProvider });
        }
    }, [activeChatId, setProvider, updateChat]);
    
    // Function to handle persona change
    const handlePersonaChange = useCallback((newPersona: string) => {
        setPersona(newPersona);
        
        // Update persona for active chat if one exists
        if (activeChatId) {
            updateChat(activeChatId, { persona: newPersona });
        }
    }, [activeChatId, setPersona, updateChat]);
    
    // Function to handle temperature change
    const handleTemperatureChange = useCallback((newValue: number) => {
        setTemperature(newValue);
        
        // Update temperature for active chat if one exists
        if (activeChatId) {
            updateChat(activeChatId, { temperature: newValue });
        }
    }, [activeChatId, setTemperature, updateChat]);
    
    // Function to handle max tokens change
    const handleMaxTokensChange = useCallback((newValue: number) => {
        setMaxTokens(newValue);
        
        // Update max tokens for active chat if one exists
        if (activeChatId) {
            updateChat(activeChatId, { maxTokens: newValue });
        }
    }, [activeChatId, setMaxTokens, updateChat]);
    
    // Update model when provider changes
    useEffect(() => {
        const models = getModelsForProvider(provider);
        if (models.length > 0) {
            setModel(models[0].id);
        }
    }, [provider, setModel]);
    
    // Prepare personas list - would normally come from a database or API
    const personas = [
        { id: 'default', label: 'Default Assistant' },
        { id: 'creative', label: 'Creative Writer' },
        { id: 'academic', label: 'Academic Expert' },
        { id: 'coder', label: 'Code Assistant' },
        { id: 'legal', label: 'Legal Advisor' },
        { id: 'scientific', label: 'Scientific Expert' },
        { id: 'medical', label: 'Medical Professional' },
        { id: 'tutor', label: 'Education Tutor' },
        { id: 'friendly', label: 'Friendly Companion' },
        { id: 'businesslike', label: 'Business Professional' },
        { id: 'historical', label: 'Historical Guide' },
        { id: 'philosophical', label: 'Philosophical Thinker' },
        { id: 'spiritual', label: 'Spiritual Guide' },
        { id: 'technical', label: 'Technical Support' },
        { id: 'storyteller', label: 'Storyteller' },
        { id: 'custom', label: 'Custom Persona' },
    ];
    
    // Mock list of models - would be fetched dynamically based on selected provider
    const getModelsForProvider = (provider: Provider) => {
        switch (provider) {
            case 'groq':
                return [
                    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Default)' },
                    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B' },
                    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
                    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
                    { id: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision (Preview)' },
                    { id: 'mistral-saba-24b', label: 'Mistral Saba 24B' },
                    { id: 'qwen-2.5-32b', label: 'Qwen 2.5 32B' },
                    { id: 'qwen-2.5-coder-32b', label: 'Qwen 2.5 Coder 32B' },
                    { id: 'qwen-qwq-32b', label: 'Qwen QWQ 32B' },
                    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
                    { id: 'distil-whisper-large-v3-en', label: 'Distil Whisper Large V3 (English)' },
                    { id: 'whisper-large-v3', label: 'Whisper Large V3' },
                    { id: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo' },
                    { id: 'gemma2-9b-it', label: 'Gemma 2 9B IT' },
                    { id: 'playai-tts', label: 'PlayAI TTS' }
                ];
            case 'openai':
                return [
                    { id: 'gpt-4-1106-preview', label: 'GPT-4 Turbo Preview' },
                    { id: 'gpt-4-vision-preview', label: 'GPT-4 Vision Preview' },
                    { id: 'gpt-4', label: 'GPT-4' },
                    { id: 'gpt-4-32k', label: 'GPT-4 32K' },
                    { id: 'gpt-3.5-turbo-0125', label: 'GPT-3.5 Turbo (Latest)' },
                    { id: 'gpt-3.5-turbo-16k', label: 'GPT-3.5 Turbo 16K' },
                    { id: 'dall-e-3', label: 'DALL·E 3' },
                    { id: 'tts-1-hd', label: 'TTS-1 HD' },
                    { id: 'whisper-1', label: 'Whisper v3' }
                ];
            case 'anthropic':
                return [
                    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Latest)' },
                    { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Latest)' },
                    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Latest)' },
                    { id: 'claude-2.1', label: 'Claude 2.1' },
                    { id: 'claude-2.0', label: 'Claude 2.0' },
                    { id: 'claude-instant-1.2', label: 'Claude Instant 1.2' }
                ];
            case 'mistral':
                return [
                    { id: 'mistral-large-latest', label: 'Mistral Large (Latest)' },
                    { id: 'mistral-medium-latest', label: 'Mistral Medium (Latest)' },
                    { id: 'mistral-small-latest', label: 'Mistral Small (Latest)' },
                    { id: 'mistral-embed', label: 'Mistral Embed' }
                ];
            case 'deepseek':
                return [
                    { id: 'deepseek-chat-67b', label: 'DeepSeek Chat 67B' },
                    { id: 'deepseek-coder-33b', label: 'DeepSeek Coder 33B' },
                    { id: 'deepseek-coder-instruct-33b', label: 'DeepSeek Coder Instruct 33B' },
                    { id: 'deepseek-math-7b', label: 'DeepSeek Math 7B' },
                    { id: 'deepseek-vision-base-7b', label: 'DeepSeek Vision Base 7B' }
                ];
            case 'cohere':
                return [
                    { id: 'command', label: 'Command (Latest)' },
                    { id: 'command-light', label: 'Command Light' },
                    { id: 'command-nightly', label: 'Command Nightly' },
                    { id: 'embed-english-v3.0', label: 'Embed English v3.0' },
                    { id: 'embed-multilingual-v3.0', label: 'Embed Multilingual v3.0' }
                ];
            case 'huggingface':
                return [
                    { id: 'meta-llama/Llama-2-70b-chat-hf', label: 'Llama 2 70B Chat' },
                    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B Instruct' },
                    { id: 'google/gemma-7b-it', label: 'Gemma 7B Instruct' },
                    { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'Stable Diffusion XL' },
                    { id: 'openai-whisper/large-v3', label: 'Whisper Large v3' }
                ];
            case 'alibaba':
                return [
                    { id: 'qwen-max', label: 'Qwen Max' },
                    { id: 'qwen-max-longcontext', label: 'Qwen Max Long Context' },
                    { id: 'qwen-plus', label: 'Qwen Plus' },
                    { id: 'qwen-turbo', label: 'Qwen Turbo' },
                    { id: 'qwen-audio-turbo', label: 'Qwen Audio Turbo' }
                ];
            case 'xai':
                return [
                    { id: 'grok-1', label: 'Grok-1' }
                ];
            default:
                return [{ id: 'default-model', label: 'Default Model' }];
        }
    };
    
    return (
        <main className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar with scrolling */}
            <div className="w-72 border-r border-border bg-muted/30 flex flex-col h-full">
                <div className="p-4 flex flex-col overflow-y-auto scrollbar-thin">
                    {/* App Title with Theme Toggle */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <h1 className="text-2xl font-bold">Omni Chat</h1>
                        <p className="text-sm text-muted-foreground">A versatile AI chat app</p>
                        
                        {/* Theme Toggle Button */}
                        <div className="mt-4">
                            <ThemeToggle />
                        </div>
                    </div>
                    
                    {/* Settings Button */}
                    <div className="pt-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted transition-colors text-sm font-medium"
                        >
                            <Cog6ToothIcon className="h-5 w-5" />
                            <span>Settings</span>
                        </button>
                        
                        {/* Settings Drawer */}
                        {showSettings && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-4 space-y-4"
                            >
                                {/* Mode Selection */}
                                <div>
                                    <h2 className="text-sm font-medium mb-2">Mode</h2>
                                    <select
                                        value={activeChat?.mode || mode}
                                        onChange={(e) => handleModeChange(e.target.value as ChatMode)}
                                        className="w-full p-2 rounded-md bg-background border border-input"
                                        disabled={isLoading}
                                    >
                                        <option value="default">Default Mode - chat with AI</option>
                                        <option value="rag">RAG Mode - retrieval augmented generation</option>
                                        <option value="document">Document Chat - chat with documents</option>
                                        <option value="image">Image Mode - text to image generation</option>
                                        <option value="audio">Audio Mode - audio processing</option>
                                    </select>
                                </div>
                                
                                {/* Persona Selection */}
                                <div>
                                    <h2 className="text-sm font-medium mb-2">Persona</h2>
                                    <select
                                        value={activeChat?.persona || persona}
                                        onChange={(e) => handlePersonaChange(e.target.value)}
                                        className="w-full p-2 rounded-md bg-background border border-input"
                                        disabled={isLoading}
                                    >
                                        {personas.map(p => (
                                            <option key={p.id} value={p.id}>{p.label}</option>
                                        ))}
                                    </select>
                                    
                                    {/* Custom Persona Input (show only if custom is selected) */}
                                    {(activeChat?.persona || persona) === 'custom' && (
                                        <textarea
                                            placeholder="Enter custom system message here..."
                                            className="w-full mt-2 p-2 rounded-md bg-background border border-input h-20 text-sm"
                                            disabled={isLoading}
                                        />
                                    )}
                                </div>
                                
                                {/* Temperature Slider */}
                                <div>
                                    <h2 className="text-sm font-medium mb-2">Temperature</h2>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={activeChat?.temperature || temperature}
                                        onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                                        className="w-full"
                                        disabled={isLoading}
                                    />
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {activeChat?.temperature || temperature}
                                    </div>
                                </div>
                                
                                {/* Max Tokens Slider */}
                                <div>
                                    <h2 className="text-sm font-medium mb-2">Max Tokens</h2>
                                    <input
                                        type="range"
                                        min="100"
                                        max="4000"
                                        value={activeChat?.maxTokens || maxTokens}
                                        onChange={(e) => handleMaxTokensChange(Number(e.target.value))}
                                        className="w-full"
                                        disabled={isLoading}
                                    />
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {activeChat?.maxTokens || maxTokens} tokens
                                    </div>
                                </div>
                                
                                {/* Text Size Option */}
                                <div>
                                    <h2 className="text-sm font-medium mb-2">Text Size</h2>
                                    <select
                                        value={textSize}
                                        onChange={(e) => setTextSize(e.target.value)}
                                        className="w-full p-2 rounded-md bg-background border border-input"
                                    >
                                        <option value="small">Small</option>
                                        <option value="medium">Medium</option>
                                        <option value="large">Large</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}
                    </div>
                    
                    {/* Provider Selection */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <h2 className="text-sm font-medium mb-2">Provider</h2>
                            <select
                                value={activeChat?.provider || provider}
                                onChange={(e) => handleProviderChange(e.target.value as Provider)}
                                className="w-full p-2 rounded-md bg-background border border-input"
                                disabled={isLoading}
                            >
                                <option value="groq">Groq</option>
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="mistral">Mistral</option>
                                <option value="deepseek">DeepSeek</option>
                                <option value="alibaba">Alibaba (Dashscope)</option>
                                <option value="xai">X AI</option>
                                <option value="huggingface">Hugging Face</option>
                            </select>
                        </div>
                        
                        {/* Model Selection */}
                        <div>
                            <h2 className="text-sm font-medium mb-2">Model</h2>
                            <select
                                value={activeChat?.model || model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full p-2 rounded-md bg-background border border-input"
                                disabled={isLoading}
                            >
                                {getModelsForProvider(activeChat?.provider || provider).map(model => (
                                    <option key={model.id} value={model.id}>{model.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-6 grid grid-cols-3 gap-2">
                        <button
                            onClick={handleRetry}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                            disabled={!activeChat || activeChat.messages.length < 2 || isLoading}
                        >
                            <ArrowPathIcon className="h-5 w-5 mb-1" />
                            <span>Retry</span>
                        </button>
                        <button
                            onClick={handleNewChat}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                        >
                            <PlusIcon className="h-5 w-5 mb-1" />
                            <span>New</span>
                        </button>
                        <button
                            onClick={handleSaveChat}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                            disabled={!activeChat}
                        >
                            <BookmarkIcon className="h-5 w-5 mb-1" />
                            <span>Save</span>
                        </button>
                        <button
                            onClick={handleLoadChat}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                        >
                            <FolderOpenIcon className="h-5 w-5 mb-1" />
                            <span>Load</span>
                        </button>
                        <button
                            onClick={() => activeChat && deleteChat(activeChat.id)}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                            disabled={!activeChat}
                        >
                            <TrashIcon className="h-5 w-5 mb-1" />
                            <span>Delete</span>
                        </button>
                        <button
                            onClick={handleExportChat}
                            className="flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-xs"
                            disabled={!activeChat}
                        >
                            <ArrowDownTrayIcon className="h-5 w-5 mb-1" />
                            <span>Export</span>
                        </button>
                    </div>
                    
                    <div className="mt-auto mb-2 text-xs text-muted-foreground text-center">
                        <p>Custom AI Chat Implementation</p>
                    </div>
                </div>
            </div>
            
            {/* Chat area */}
            <div className="flex-1 flex flex-col h-full">
                {/* Add a debug section to show messages directly */}
                <div className="px-4 py-2 bg-yellow-100 text-xs" style={{ display: 'none' }}>
                    <p>Debug - Active Chat ID: {activeChatId || 'none'}</p>
                    <p>Chat Sessions: {chatSessions.length}</p>
                    {activeChat && (
                        <p>Messages in active chat: {activeChat.messages.length}</p>
                    )}
                </div>
                
                {/* Messages */}
                <div className={`flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full ${textSize === 'small' ? 'text-sm' : textSize === 'large' ? 'text-lg' : 'text-base'}`}>
                    {(!activeChat || !activeChat.messages || activeChat.messages.length === 0) ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <h2 className="text-2xl font-bold mb-2">Welcome to Omni Chat</h2>
                            <p className="max-w-md mx-auto mb-8">
                                Start a new conversation by typing a message below.
                            </p>
                        </div>
                    ) : (
                        <ChatHistoryText messages={activeChat.messages} />
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* File upload component for relevant modes */}
                {activeChat && ['document', 'image', 'audio'].includes(activeChat.mode) && (
                    <FileUpload
                        mode={activeChat.mode}
                        onFileUpload={handleFileUpload}
                        disabled={isLoading}
                    />
                )}
                
                {/* Input component */}
                <ChatInput
                    onSubmit={(content) => handleMessageSubmit(content, activeChat?.mode || mode)}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    isLoading={isLoading}
                    mode={activeChat?.mode || mode}
                />
            </div>
        </main>
    );
}
