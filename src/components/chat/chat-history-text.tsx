import React from 'react';
import { ChatMessage } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatHistoryTextProps {
    messages: ChatMessage[];
}

export function ChatHistoryText({ messages }: ChatHistoryTextProps) {
    // Group messages into user-assistant pairs
    const messagePairs = [];
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
            // Find the next assistant message
            const userMessage = messages[i];
            const assistantMessage = messages[i + 1] && messages[i + 1].role === 'assistant' 
                ? messages[i + 1] 
                : null;
            
            messagePairs.push({ user: userMessage, assistant: assistantMessage });
            
            // Skip the assistant message in the next iteration
            if (assistantMessage) i++;
        }
    }

    return (
        <div className="p-4 rounded-lg bg-muted/30">
            <div className="prose dark:prose-invert max-w-none">
                {messagePairs.map((pair, index) => (
                    <div key={index} className="mb-8">
                        {/* User message */}
                        <div className="mb-4">
                            <div className="text-blue-500 font-semibold mb-1">You</div>
                            <div className="p-3 rounded-md bg-muted/50 whitespace-pre-wrap">
                                {pair.user.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {new Date(pair.user.createdAt).toLocaleString()}
                            </div>
                        </div>
                        
                        {/* Assistant message */}
                        {pair.assistant && (
                            <div className="mb-4">
                                <div className="text-green-500 font-semibold mb-1">Assistant</div>
                                <div className="p-3 rounded-md bg-primary/10 whitespace-pre-wrap">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code: ({ children, className }) => {
                                                const language = className ? className.replace('language-', '') : '';
                                                return (
                                                    <div className="relative my-2">
                                                        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground rounded-bl bg-muted/50">
                                                            {language || 'text'}
                                                        </div>
                                                        <pre className={`${language ? `language-${language}` : ''} rounded-md bg-muted/50 p-3 overflow-x-auto`}>
                                                            <code>{children}</code>
                                                        </pre>
                                                    </div>
                                                );
                                            },
                                            p: ({ children }) => (
                                                <p className="my-2">{children}</p>
                                            ),
                                            hr: () => (
                                                <hr className="my-4 border-t border-border" />
                                            )
                                        }}
                                    >
                                        {pair.assistant.content}
                                    </ReactMarkdown>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(pair.assistant.createdAt).toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
} 