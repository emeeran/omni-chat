export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMode = 'default' | 'rag' | 'document' | 'image' | 'audio';
export type Provider = 'groq' | 'openai' | 'anthropic' | 'mistral' | 'deepseek' | 'cohere' | 'dashscope' | 'huggingface';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date | string;
  mode?: ChatMode;
  provider?: Provider;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date | string;
  messages: ChatMessage[];
  mode: ChatMode;
  provider: Provider;
  model: string;
  persona: string;
  temperature: number;
  maxTokens: number;
  fileData?: {
    name: string;
    type: string;
    size: number;
  };
} 