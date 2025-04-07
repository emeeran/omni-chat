'use client';

import { formatDate } from '@/lib/utils';
import { ChatMessage } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

export function Message({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
        >
            <div
                className={`max-w-3xl px-4 py-3 rounded-2xl ${isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                    : 'bg-muted dark:bg-slate-800 rounded-tl-none'
                    }`}
            >
                <div className="flex items-center mb-1">
                    <span className="font-medium text-sm">
                        {isUser ? 'You' : 'AI Assistant'}
                    </span>
                    <span className="text-xs ml-2 opacity-70">
                        {formatDate(message.createdAt)}
                    </span>
                    {message.provider && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground/80">
                            {message.provider}
                        </span>
                    )}
                    {message.mode && message.mode !== 'default' && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary-foreground/80">
                            {message.mode}
                        </span>
                    )}
                </div>
                <div className="prose dark:prose-invert prose-sm max-w-none overflow-auto max-h-[60vh]">
                    {message.content ? (
                        <ReactMarkdown className="break-words whitespace-pre-wrap">{message.content}</ReactMarkdown>
                    ) : (
                        <p className="text-muted-foreground italic">No content to display</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}