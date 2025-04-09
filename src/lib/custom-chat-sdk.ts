import { ChatMode, Provider } from './utils';

interface RequestOptions {
    mode: ChatMode;
    provider: Provider;
    model?: string;
    persona?: string;
    temperature?: number;
    maxTokens?: number;
    fileData?: {
        name: string;
        type: string;
        size: number;
    };
}

export class CustomChatSDK {
    private initialized = false;

    public init(): void {
        console.log('CustomChatSDK initialized');
        this.initialized = true;
    }

    public async generateResponse(content: string, options: RequestOptions): Promise<string> {
        console.log("Generating response for:", content);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'user', content }
                    ],
                    provider: options.provider,
                    mode: options.mode,
                    model: options.model,
                    temperature: options.temperature,
                    maxTokens: options.maxTokens,
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            let result = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                result += chunk;
            }

            return result;
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }
}
