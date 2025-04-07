'use client';

import { useState } from 'react';
import { CHAT_MODES, ChatMode } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ChatBubbleLeftRightIcon, DocumentIcon, PhotoIcon, MicrophoneIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ModeSelectorProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    disabled?: boolean;
}

export function ModeSelector({ currentMode, onModeChange, disabled = false }: ModeSelectorProps) {
    const getIconForMode = (mode: string) => {
        switch (mode) {
            case 'default':
                return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
            case 'rag':
                return <MagnifyingGlassIcon className="h-5 w-5" />;
            case 'document':
                return <DocumentIcon className="h-5 w-5" />;
            case 'image':
                return <PhotoIcon className="h-5 w-5" />;
            case 'audio':
                return <MicrophoneIcon className="h-5 w-5" />;
            default:
                return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
        }
    };

    return (
        <div className="flex flex-wrap gap-2 p-2">
            {CHAT_MODES.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => !disabled && onModeChange(mode.id as ChatMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentMode === mode.id
                            ? 'bg-primary/90 text-primary-foreground shadow-sm'
                            : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={disabled}
                >
                    {getIconForMode(mode.id)}
                    <span>{mode.label}</span>

                    {currentMode === mode.id && (
                        <motion.div
                            layoutId="activeModePill"
                            className="absolute inset-0 rounded-lg bg-primary/90"
                            style={{ zIndex: -1 }}
                            transition={{ type: "spring", duration: 0.5 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
}