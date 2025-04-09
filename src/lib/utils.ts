import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type ChatMode = 'default' | 'rag' | 'document' | 'image' | 'audio';

export type Provider = 
  | 'groq' 
  | 'openai' 
  | 'anthropic' 
  | 'mistral' 
  | 'deepseek' 
  | 'cohere' 
  | 'dashscope' 
  | 'huggingface' 
  | 'fireworks' 
  | 'google' 
  | 'alibaba' 
  | 'xai';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 