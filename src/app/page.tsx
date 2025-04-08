'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
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

export default function Home() {
    // State for active chat ID
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    // State for chat sessions
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

    // State for UI toggles
    const [showSettings, setShowSettings] = useState(false);

    // State for file upload
    const [currentFile, setCurrentFile] = useState<File | null>(null);

    // Ref for scrolling to bottom of chat
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // State for current settings
    const [mode, setMode] = useState<ChatMode>('default');
    const [provider, setProvider] = useState<Provider>('groq'); // Default to Groq as per spec
    const [model, setModel] = useState<string>(''); // Will be populated dynamically
    const [persona, setPersona] = useState<string>('default');
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(1000);
    const [textSize, setTextSize] = useState('medium');

    // Get active chat session
    const activeChat = activeChatId
        ? chatSessions.find(chat => chat.id === activeChatId)
        : null;

    // Integration with Vercel AI SDK's useChat hook
    const { messages: aiMessages, input, handleInputChange, handleSubmit: submitAiMessage, isLoading, setMessages } = useChat({
        api: '/api/chat',
        id: activeChatId || undefined,
        body: {
            mode: activeChat?.mode || mode,
            provider: activeChat?.provider || provider,
            model: activeChat?.model || model,
            persona: activeChat?.persona || persona,
            temperature: activeChat?.temperature || temperature,
            maxTokens: activeChat?.maxTokens || maxTokens,
            fileData: activeChat?.fileData,
        },
        onResponse: (response) => {
            // For debugging
            console.log("Got response from API:", response);
        },
        onFinish: (message) => {
            console.log("Message finished:", message);

            if (!message || !message.content || !message.content.trim()) {
                console.warn("Empty message content received");
                return;
            }

            // Create assistant message
            const assistantMessage: ChatMessage = {
                id: message.id || uuidv4(),
                role: 'assistant',
                content: message.content,
                createdAt: new Date(),
                mode: activeChat?.mode || mode,
                provider: activeChat?.provider || provider,
            };

            console.log("Created assistant message:", assistantMessage);

            // Update chat session with new message
            if (activeChatId) {
                setChatSessions(prevSessions => {
                    const updatedSessions = prevSessions.map(session =>
                        session.id === activeChatId
                            ? {
                                ...session,
                                messages: [...session.messages, assistantMessage],
                            }
                            : session
                    );
                    console.log("Updated chat sessions:", updatedSessions);
                    return updatedSessions;
                });
            } else {
                console.log("No active chat ID found for updating messages.");
            }
        },
    });

    // Sync AI SDK messages with our chat sessions when AI messages change
    useEffect(() => {
        if (!activeChatId || !aiMessages || aiMessages.length === 0) return;
        
        // Check if the last AI message is already in our chat session
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        if (lastAiMessage.role === 'assistant') {
            const activeSession = chatSessions.find(chat => chat.id === activeChatId);
            if (activeSession) {
                const hasMessage = activeSession.messages.some(msg => 
                    msg.role === 'assistant' && msg.id === lastAiMessage.id
                );
                
                if (!hasMessage) {
                    // Add the new assistant message
                    const assistantMessage: ChatMessage = {
                        id: lastAiMessage.id || uuidv4(),
                        role: 'assistant',
                        content: lastAiMessage.content,
                        createdAt: new Date(),
                        mode: activeChat?.mode || mode,
                        provider: activeChat?.provider || provider,
                    };
                    
                    setChatSessions(prevSessions => {
                        return prevSessions.map(session =>
                            session.id === activeChatId
                                ? {
                                    ...session,
                                    messages: [...session.messages, assistantMessage],
                                }
                                : session
                        );
                    });
                }
            }
        }
    }, [aiMessages, activeChatId, chatSessions, activeChat?.mode, mode, activeChat?.provider, provider]);

    // Function to create a new chat
    const handleNewChat = () => {
        const newChatId = uuidv4();

        const newChat: ChatSession = {
            id: newChatId,
            title: 'New Chat',
            createdAt: new Date(),
            messages: [],
            mode,
            provider,
            model,
            persona,
            temperature,
            maxTokens
        };

        setChatSessions(prev => [...prev, newChat]);
        setActiveChatId(newChatId);
        setCurrentFile(null);
        setMessages([]);
    };

    // Function to handle retry (regenerate last response)
    const handleRetry = () => {
        if (!activeChat || activeChat.messages.length < 2) return;

        // Remove the last assistant message
        setChatSessions(prev =>
            prev.map(session =>
                session.id === activeChatId
                    ? {
                        ...session,
                        messages: session.messages.slice(0, -1)
                    }
                    : session
            )
        );

        // Get user messages for AI resubmission
        const userMessages = activeChat.messages.filter(msg => msg.role === 'user');
        if (userMessages.length > 0) {
            // Convert to AI SDK message format
            const aiFormatMessages = userMessages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content
            }));
            
            // Set current messages and re-submit the last user message
            setMessages(aiFormatMessages);
            const lastUserMsg = userMessages[userMessages.length - 1];
            
            setTimeout(() => {
                // Trigger submission with the last user message
                const event = new Event('submit', { bubbles: true, cancelable: true });
                submitAiMessage(event as unknown as React.FormEvent<HTMLFormElement>);
            }, 100);
        }
    };

    // Function to save the current chat
    const handleSaveChat = () => {
        if (!activeChat) return;
        // In a real app, this would save to a database or local storage
        alert('Chat saved! In a production app, this would save to a database.');
    };

    // Function to load a saved chat
    const handleLoadChat = () => {
        // In a real app, this would load from a database or local storage
        alert('In a production app, this would open a dialog to load a saved chat.');
    };

    // Function to export the current chat
    const handleExportChat = () => {
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
    };

    // Function to delete a chat
    const handleDeleteChat = (chatId: string) => {
        setChatSessions(prev => prev.filter(chat => chat.id !== chatId));

        if (activeChatId === chatId) {
            setActiveChatId(null);
            setCurrentFile(null);
        }
    };

    // Function to handle file upload
    const handleFileUpload = (file: File) => {
        setCurrentFile(file);

        // Update the active chat with file data
        if (activeChatId) {
            setChatSessions(prev =>
                prev.map(session =>
                    session.id === activeChatId
                        ? {
                            ...session,
                            fileData: {
                                name: file.name,
                                type: file.type,
                                size: file.size,
                            }
                        }
                        : session
                )
            );
        }
    };

    // Function to handle message submission
    const handleMessageSubmit = (content: string, currentMode: ChatMode) => {
        // Create user message
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: content,
            createdAt: new Date(),
            mode: currentMode,
            provider,
        };

        // If no active chat, create one
        if (!activeChatId) {
            const newChatId = uuidv4();
            const chatTitle = content.length > 30 ? `${content.substring(0, 30)}...` : content;

            const newChat: ChatSession = {
                id: newChatId,
                title: chatTitle,
                createdAt: new Date(),
                messages: [userMessage],
                mode: currentMode,
                provider,
                model,
                persona,
                temperature,
                maxTokens,
                // Include file data if available
                fileData: currentFile ? {
                    name: currentFile.name,
                    type: currentFile.type,
                    size: currentFile.size,
                } : undefined,
            };

            setChatSessions(prev => [...prev, newChat]);
            setActiveChatId(newChatId);
        } else {
            // Update existing chat
            setChatSessions(prev =>
                prev.map(session =>
                    session.id === activeChatId
                        ? {
                            ...session,
                            messages: [...session.messages, userMessage],
                            // Update title for new chats with only one message
                            title: session.messages.length === 0
                                ? (content.length > 30 ? `${content.substring(0, 30)}...` : content)
                                : session.title,
                        }
                        : session
                )
            );
        }

        // Submit to AI
        handleInputChange({ target: { value: content } } as React.ChangeEvent<HTMLInputElement>);
        
        setTimeout(() => {
            const event = new Event('submit', { bubbles: true, cancelable: true });
            submitAiMessage(event as unknown as React.FormEvent<HTMLFormElement>);
        }, 100);
    };

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
                    { id: 'gpt-4o', label: 'GPT-4o' },
                    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                ];
            case 'anthropic':
                return [
                    { id: 'claude-3-opus', label: 'Claude 3 Opus' },
                    { id: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
                    { id: 'claude-3-haiku', label: 'Claude 3 Haiku' }
                ];
            case 'mistral':
                return [
                    { id: 'mistral-large', label: 'Mistral Large' },
                    { id: 'mistral-medium', label: 'Mistral Medium' },
                    { id: 'mistral-small', label: 'Mistral Small' }
                ];
            default:
                return [{ id: 'default-model', label: 'Default Model' }];
        }
    };

    // Update model when provider changes
    useEffect(() => {
        const models = getModelsForProvider(provider);
        if (models.length > 0) {
            setModel(models[0].id);
        }
    }, [provider]);

    // Function to handle mode change
    const handleModeChange = (newMode: ChatMode) => {
        setMode(newMode);

        // Update mode for active chat if one exists
        if (activeChatId) {
            setChatSessions(prev =>
                prev.map(session =>
                    session.id === activeChatId
                        ? { ...session, mode: newMode }
                        : session
                )
            );
        }

        // Reset file when changing mode
        setCurrentFile(null);
    };

    // Function to handle provider change
    const handleProviderChange = (newProvider: Provider) => {
        setProvider(newProvider);

        // Update provider for active chat if one exists
        if (activeChatId) {
            setChatSessions(prev =>
                prev.map(session =>
                    session.id === activeChatId
                        ? { ...session, provider: newProvider }
                        : session
                )
            );
        }
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChat?.messages]);

    // Initialize with a new chat on first load
    useEffect(() => {
        if (chatSessions.length === 0) {
            handleNewChat();
        }
    }, []);

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
                                        onChange={(e) => setPersona(e.target.value)}
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
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-sm font-medium">Temperature</h2>
                                        <span className="text-xs text-muted-foreground">{temperature}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={activeChat?.temperature || temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full"
                                        disabled={isLoading}
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>Precise</span>
                                        <span>Creative</span>
                                    </div>
                                </div>

                                {/* Max Tokens Slider */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-sm font-medium">Max Tokens</h2>
                                        <span className="text-xs text-muted-foreground">{maxTokens}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="100"
                                        max="4000"
                                        step="100"
                                        value={activeChat?.maxTokens || maxTokens}
                                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                        className="w-full"
                                        disabled={isLoading}
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>Shorter</span>
                                        <span>Longer</span>
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
                            onClick={() => activeChat && handleDeleteChat(activeChat.id)}
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
                        <p>Using Vercel AI SDK</p>
                    </div>
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col h-full">
                {/* Messages */}
                <div className={`flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full ${textSize === 'small' ? 'text-sm' : textSize === 'large' ? 'text-lg' : 'text-base'
                    }`}>
                    {(!activeChat || activeChat.messages.length === 0) ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <h2 className="text-2xl font-bold mb-2">Welcome to Omni Chat</h2>
                            <p className="max-w-md mx-auto mb-8">
                                Start a new conversation by typing a message below.
                            </p>

                            {activeChat && ['document', 'image', 'audio'].includes(activeChat.mode) && (
                                <div className="mt-6">
                                    <p className="text-sm font-medium">
                                        {activeChat.mode === 'document' && 'Upload a document to chat about its contents'}
                                        {activeChat.mode === 'image' && 'Upload an image or provide a description to generate one'}
                                        {activeChat.mode === 'audio' && 'Upload an audio file or provide text to convert to speech'}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeChat.messages.map((message) => (
                                <Message key={message.id} message={message} />
                            ))}
                            <div className="h-4" />
                        </div>
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

                {/* Input */}
                <ChatInput
                    onSubmit={(content) => handleMessageSubmit(content, activeChat?.mode || mode)}
                    isLoading={isLoading}
                    mode={activeChat?.mode || mode}
                />
            </div>
        </main>
    );
}
