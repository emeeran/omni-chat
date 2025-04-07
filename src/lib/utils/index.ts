export function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date) {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    });
}

export type ChatMode = 'default' | 'rag' | 'document' | 'image' | 'audio';

export type Provider =
    | 'openai'
    | 'anthropic'
    | 'groq'
    | 'mistral'
    | 'fireworks'
    | 'google';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
    mode?: ChatMode;
    provider?: Provider;
}

export const CHAT_MODES = [
    { id: 'default', label: 'Chat' },
    { id: 'rag', label: 'RAG' },
    { id: 'document', label: 'Document' },
    { id: 'image', label: 'Image' },
    { id: 'audio', label: 'Audio' },
] as const;

export const PROVIDERS = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'groq', label: 'Groq' },
    { id: 'mistral', label: 'Mistral' },
    { id: 'fireworks', label: 'Fireworks' },
    { id: 'google', label: 'Google' },
] as const;