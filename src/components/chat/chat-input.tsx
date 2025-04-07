'use client';

import { useState, FormEvent } from 'react';
import { PaperAirplaneIcon, MicrophoneIcon, PhotoIcon } from '@heroicons/react/24/solid';
import { CornerDownLeftIcon, Loader2 } from 'lucide-react';
import { ChatMode } from '@/lib/utils';

interface ChatInputProps {
    onSubmit: (message: string, mode: ChatMode) => void;
    isLoading: boolean;
    mode: ChatMode;
    disabled?: boolean;
}

export function ChatInput({ onSubmit, isLoading, mode, disabled = false }: ChatInputProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!input.trim() || isLoading || disabled) return;

        onSubmit(input, mode);
        setInput('');
    };

    const showAudioButton = mode === 'audio';
    const showImageButton = mode === 'image';

    return (
        <form
            onSubmit={handleSubmit}
            className="relative flex items-center border-t dark:border-gray-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2"
        >
            {showImageButton && (
                <button
                    type="button"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Upload image"
                    disabled={isLoading || disabled}
                >
                    <PhotoIcon className="h-5 w-5" />
                </button>
            )}

            {showAudioButton && (
                <button
                    type="button"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Record audio"
                    disabled={isLoading || disabled}
                >
                    <MicrophoneIcon className="h-5 w-5" />
                </button>
            )}

            <div className="relative flex-1 mx-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isLoading ? "AI is thinking..." : "Type a message..."}
                    className="w-full p-3 rounded-xl bg-muted/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    disabled={isLoading || disabled}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                    {!isLoading && input.length > 0 && (
                        <CornerDownLeftIcon className="h-4 w-4 opacity-70" />
                    )}
                </div>
            </div>

            <button
                type="submit"
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={!input.trim() || isLoading || disabled}
                aria-label="Send message"
            >
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <PaperAirplaneIcon className="h-5 w-5" />
                )}
            </button>
        </form>
    );
}