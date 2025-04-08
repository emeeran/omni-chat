'use client';

import { formatDate } from '@/lib/utils';
import { ChatMessage } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function Message({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    // For debugging purposes
    useEffect(() => {
        if (!message.content || message.content.trim() === '') {
            console.warn("Empty message content:", message);
        }
    }, [message]);

    // Safety check for message content
    if (!message || !message.content) {
        console.error("Invalid message object:", message);
        return (
            <div className="w-full mb-6 border-b border-border/30 pb-4">
                <div className="flex items-center gap-2 text-sm mb-2">
                    <span className={`font-semibold ${isUser ? 'text-primary' : 'text-secondary'}`}>
                        {isUser ? 'You' : 'AI Assistant'}
                    </span>
                </div>
                <p className="text-muted-foreground italic">Error displaying message content</p>
            </div>
        );
    }

    return (
        <div className="w-full mb-6 border-b border-border/30 pb-4">
            <div className="flex items-center gap-2 text-sm mb-2">
                <span className={`font-semibold ${isUser ? 'text-primary' : 'text-secondary'}`}>
                    {isUser ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-xs text-muted-foreground">
                    {formatDate(message.createdAt)}
                </span>
                {message.provider && (
                    <span className="text-xs text-muted-foreground">
                        via {message.provider}
                    </span>
                )}
                {message.mode && message.mode !== 'default' && (
                    <span className="text-xs text-muted-foreground">
                        • {message.mode} mode
                    </span>
                )}
            </div>
            <div className="prose dark:prose-invert max-w-none mt-2">
                {message.content && message.content.trim() ? (
                    <ReactMarkdown 
                        className="whitespace-pre-wrap break-words"
                        components={{
                            // Improve code block rendering
                            code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                const language = match ? match[1] : '';
                                
                                return !inline && language ? (
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={language}
                                        PreTag="div"
                                        wrapLines={true}
                                        showLineNumbers={true}
                                        customStyle={{
                                            marginTop: '0.5em',
                                            marginBottom: '0.5em',
                                            borderRadius: '0.375rem',
                                            background: '#1e1e1e'
                                        }}
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={`${className} rounded bg-gray-200 dark:bg-gray-800 px-1 py-0.5`} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                            // Improve paragraph spacing
                            p({children}) {
                                return <p className="mb-4 last:mb-0">{children}</p>;
                            },
                            // Improve list rendering
                            ul({children}) {
                                return <ul className="pl-6 list-disc mb-4">{children}</ul>;
                            },
                            ol({children}) {
                                return <ol className="pl-6 list-decimal mb-4">{children}</ol>;
                            },
                            // Better table styling
                            table({children}) {
                                return (
                                    <div className="overflow-x-auto mb-4">
                                        <table className="border-collapse border border-border">{children}</table>
                                    </div>
                                );
                            },
                            th({children}) {
                                return <th className="border border-border px-4 py-2 bg-muted font-semibold">{children}</th>;
                            },
                            td({children}) {
                                return <td className="border border-border px-4 py-2">{children}</td>;
                            }
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                ) : (
                    <p className="text-muted-foreground italic">No content to display</p>
                )}
            </div>
        </div>
    );
}