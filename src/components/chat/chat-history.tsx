'use client';

import { useState } from 'react';
import { PlusCircleIcon, TrashIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/utils';

interface ChatHistoryItem {
    id: string;
    title: string;
    createdAt: Date;
}

interface ChatHistoryProps {
    chats: ChatHistoryItem[];
    activeChat: string | null;
    onChatSelect: (chatId: string) => void;
    onNewChat: () => void;
    onDeleteChat: (chatId: string) => void;
}

export function ChatHistory({
    chats,
    activeChat,
    onChatSelect,
    onNewChat,
    onDeleteChat,
}: ChatHistoryProps) {
    return (
        <div className="space-y-2">
            <button
                onClick={onNewChat}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted transition-colors text-sm font-medium"
            >
                <PlusCircleIcon className="h-5 w-5" />
                <span>New Chat</span>
            </button>

            <div className="mt-4 space-y-1">
                {chats.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                        No chats yet
                    </div>
                ) : (
                    chats.map((chat) => (
                        <motion.div
                            key={chat.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${activeChat === chat.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted/60'
                                }`}
                            onClick={() => onChatSelect(chat.id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <ChatBubbleLeftRightIcon className="h-4 w-4 flex-shrink-0" />
                                <div className="truncate">
                                    <div className="text-sm font-medium truncate">{chat.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {formatDate(chat.createdAt)}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(chat.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-md transition-opacity"
                            >
                                <TrashIcon className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}