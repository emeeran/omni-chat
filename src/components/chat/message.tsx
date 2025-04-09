'use client';

import React from 'react';
import { ChatMessage } from '@/lib/utils';

interface MessageProps {
    message: ChatMessage;
}

export function Message({ message }: MessageProps) {
    console.log("Rendering message:", message.id, message.role, message.content.substring(0, 30));

    return (
        <div className={`p-4 rounded-lg ${message.role === 'user' ? 'bg-muted ml-auto max-w-[80%]' : 'bg-primary/10 mr-auto max-w-[80%]'}`}>
            <div className="flex items-center mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${message.role === 'user' ? 'bg-blue-500' : 'bg-green-500'}`}>
                    <span className="text-white font-bold">
                        {message.role === 'user' ? 'U' : 'A'}
                    </span>
                </div>
                <div className="font-semibold">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
            </div>

            <div className="whitespace-pre-wrap">
                {message.content}
            </div>

            <div className="text-xs text-muted-foreground mt-2">
                {new Date(message.createdAt).toLocaleTimeString()}
            </div>
        </div>
    );
}