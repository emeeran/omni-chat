'use client';

import React, { useState } from 'react';
import { ChatMode } from '@/lib/utils';

interface ChatInputProps {
    onSubmit: (content: string) => void;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    mode: ChatMode;
}

export function ChatInput(props: ChatInputProps) {
    const [localInput, setLocalInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localInput.trim()) {
            console.log("Submitting:", localInput);
            props.onSubmit(localInput);
            setLocalInput('');
        }
    };

    return (
        <div className="p-4 border-t border-border">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 p-2 rounded-md bg-background border border-input"
                    placeholder="Type a message here..."
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    disabled={props.isLoading}
                />
                <button
                    type="submit"
                    className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    disabled={props.isLoading || !localInput.trim()}
                >
                    {props.isLoading ? 'Sending...' : 'Send'}
                </button>
            </form>
        </div>
    );
}