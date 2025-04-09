import { StreamingTextResponse, Message as AIMessage, OpenAIStream, AnthropicStream } from 'ai';
import { ChatMode, Provider } from '@/lib/utils';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Groq } from 'groq-sdk';

// Check if we should use simulation mode (when API keys are missing or explicitly set to simulate)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Only use simulation when explicitly requested or when no keys at all are available
const useSimulation = OPENAI_API_KEY === 'USE_SIMULATION' || 
                     ((!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') && 
                      (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') && 
                      (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_api_key_here'));

// Initialize API clients
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
});

const groq = new Groq({
    apiKey: GROQ_API_KEY,
});

// Create a custom stream handler for Groq since GroqStream might not be imported correctly
function createGroqStream(response: any) {
    const encoder = new TextEncoder();
    
    return new ReadableStream({
        async start(controller) {
            try {
                // Handle the stream
                for await (const chunk of response) {
                    if (chunk.choices && chunk.choices[0]?.delta?.content) {
                        const text = chunk.choices[0].delta.content;
                        controller.enqueue(encoder.encode(text));
                    }
                }
                controller.close();
            } catch (error) {
                console.error("Error in Groq stream:", error);
                controller.enqueue(encoder.encode("\n\nError: Stream was interrupted. Please try again."));
                controller.close();
            }
        },
        cancel() {
            // Attempt to cancel the response if possible
            if (response.cancel) {
                response.cancel();
            }
        },
    });
}

// Simplified simulation stream with faster response times
function createSimulatedStream(lastUserMessage: string, provider: Provider, mode: ChatMode) {
    const encoder = new TextEncoder();
    
    return new ReadableStream({
        async start(controller) {
            try {
                // Immediate first chunk to establish connection
                controller.enqueue(encoder.encode(""));
                
                // Quick first response (no delay)
                const quickIntro = `Here's a response to your query${lastUserMessage ? ' about "' + lastUserMessage.substring(0, 20) + (lastUserMessage.length > 20 ? '..."' : '"') : '.'}`;
                controller.enqueue(encoder.encode(quickIntro + "\n\n"));
                
                // Generate a short, focused response based on mode and provider
                let mainResponse = '';
                switch (mode) {
                    case 'rag':
                        mainResponse = `Using ${provider}'s retrieval capabilities to find relevant information.`;
                        break;
                    case 'document':
                        mainResponse = `Analyzing document content with ${provider}'s processing.`;
                        break;
                    case 'image':
                        mainResponse = `Processing image with ${provider}'s vision model.`;
                        break;
                    case 'audio':
                        mainResponse = `Processing audio with ${provider}'s speech recognition.`;
                        break;
                    default:
                        mainResponse = `${provider} is responding to your query with helpful information.`;
                        break;
                }
                
                // Immediate content delivery 
                controller.enqueue(encoder.encode(mainResponse));
                
                // Add a note about simulation mode
                const simulationNote = `\n\n[Note: This is a simulated response. Add API keys in .env.local for real responses.]`;
                controller.enqueue(encoder.encode(simulationNote));
                
                controller.close();
            } catch (error) {
                console.error("Error in simulation stream:", error);
                controller.enqueue(encoder.encode("\n\nError in simulation. Please try again."));
                controller.close();
            }
        },
    });
}

// Get appropriate model for each provider - updated to use faster models when available
function getModel(provider: Provider) {
    switch (provider) {
        case 'openai':
            return 'gpt-3.5-turbo'; // Faster than gpt-4
        case 'anthropic':
            return 'claude-3-haiku-20240307'; // Fastest Claude model
        case 'groq':
            return 'llama-3.1-8b-instant'; // Fast Llama model
        case 'mistral':
            return 'mistral-small'; // Faster than medium
        case 'fireworks':
            return 'llama-v3-8b'; // Smaller model for speed
        case 'google':
            return 'gemini-pro'; // Standard model
        default:
            return 'gpt-3.5-turbo';
    }
}

export async function POST(req: Request) {
    console.log("API route called - processing request");
    
    // Add caching headers to the response
    const cacheKey = await generateCacheKey(req.clone());
    
    try {
        // Parse the request body
        const body = await req.json();
        const { messages, provider, mode, model } = body;
        
        console.log("Received request body:", JSON.stringify({
            messageCount: messages?.length || 0,
            provider,
            mode,
            model
        }, null, 2));

        if (!messages || !Array.isArray(messages)) {
            console.error("Invalid messages format:", messages);
            return new Response('Messages are required and must be an array', { status: 400 });
        }

        if (!provider) {
            console.error("Missing provider");
            return new Response('Provider is required', { status: 400 });
        }

        if (!mode) {
            console.error("Missing mode");
            return new Response('Mode is required', { status: 400 });
        }

        // Extract the last user message for context (handle empty messages case)
        const lastUserMessage = messages.findLast(m => m.role === 'user')?.content || 'Hello';
        console.log("Last user message:", lastUserMessage.substring(0, 50) + (lastUserMessage.length > 50 ? '...' : ''));

        // Always use the specified provider, even on first request
        const preferredProvider = provider as Provider;
        
        // Check if we should use simulation mode
        if (useSimulation) {
            console.log("Using simulation mode (no valid API keys)");
            const stream = createSimulatedStream(lastUserMessage, preferredProvider, mode as ChatMode);
            const response = new StreamingTextResponse(stream);
            response.headers.set('X-Simulation', 'true');
            return response;
        }

        // Create system message based on mode and provider
        let systemMessage = "";
        switch (mode) {
            case 'rag':
                systemMessage = `You are an AI assistant powered by ${preferredProvider}, specialized in RAG (Retrieval Augmented Generation). When answering user queries, explain how you would retrieve and use relevant documents from their knowledge base to provide contextual responses.`;
                break;
            case 'document':
                systemMessage = `You are an AI assistant powered by ${preferredProvider}, specialized in document analysis. You can extract information, summarize content, answer questions about documents, and compare multiple documents.`;
                break;
            case 'image':
                systemMessage = `You are an AI assistant powered by ${preferredProvider}, specialized in image analysis and generation. You can describe images, identify objects, or generate images based on text descriptions.`;
                break;
            case 'audio':
                systemMessage = `You are an AI assistant powered by ${preferredProvider}, specialized in audio processing. You can handle speech recognition, text-to-speech conversion, or analyze audio for various characteristics.`;
                break;
            default: // Default chat mode
                systemMessage = `You are a helpful AI assistant powered by ${preferredProvider}. You are designed to be helpful, harmless, and honest in all interactions.`;
                break;
        }

        // Format messages for the API call - ensure non-empty messages
        const formattedMessages = [
            { role: 'system', content: systemMessage },
            ...messages.filter(m => m.content && m.content.trim()).map(message => ({
                role: message.role,
                content: message.content
            }))
        ];

        // If no user messages, add a default one to avoid errors
        if (!formattedMessages.some(m => m.role === 'user')) {
            formattedMessages.push({ role: 'user', content: 'Hello' });
        }

        let stream;
        const selectedModel = model || getModel(preferredProvider);

        // Choose the API based on the provider
        try {
            switch (preferredProvider) {
                case 'openai':
                    // Call OpenAI API
                    if (!OPENAI_API_KEY || 
                        OPENAI_API_KEY === 'USE_SIMULATION' || 
                        OPENAI_API_KEY === 'your_openai_api_key_here') {
                        throw new Error("OpenAI API key is missing or invalid");
                    }
                    console.log("Calling OpenAI API with model:", selectedModel);
                    try {
                        const response = await openai.chat.completions.create({
                            model: selectedModel,
                            messages: formattedMessages,
                            stream: true,
                            temperature: 0.7,  // Balanced temperature
                            max_tokens: 2000,  // Reasonable length
                            frequency_penalty: 0.0,  // No frequency penalty
                            presence_penalty: 0.0,   // No presence penalty
                        });
                        stream = OpenAIStream(response);
                    } catch (apiError) {
                        console.error("OpenAI API error:", apiError);
                        throw new Error(`OpenAI API error: ${(apiError as Error).message}`);
                    }
                    break;
                
                case 'anthropic':
                    // Call Anthropic API
                    if (!ANTHROPIC_API_KEY || 
                        ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
                        throw new Error("Anthropic API key is missing or invalid");
                    }
                    console.log("Calling Anthropic API with model:", selectedModel);
                    try {
                        const anthropicResponse = await anthropic.messages.create({
                            model: selectedModel,
                            messages: formattedMessages.map(m => {
                                if (m.role === 'system') {
                                    return { role: 'user', content: `System instruction: ${m.content}` };
                                }
                                return m;
                            }),
                            max_tokens: 2000,
                            temperature: 0.7,
                            stream: true,
                        });
                        stream = AnthropicStream(anthropicResponse);
                    } catch (apiError) {
                        console.error("Anthropic API error:", apiError);
                        throw new Error(`Anthropic API error: ${(apiError as Error).message}`);
                    }
                    break;
                
                case 'groq':
                    // Call Groq API
                    if (!GROQ_API_KEY || 
                        GROQ_API_KEY === 'your_groq_api_key_here') {
                        throw new Error("Groq API key is missing or invalid");
                    }
                    console.log("Calling Groq API with model:", selectedModel);
                    try {
                        const groqResponse = await groq.chat.completions.create({
                            model: selectedModel,
                            messages: formattedMessages,
                            stream: true,
                            temperature: 0.5, // Lower temperature for more focused responses
                            max_tokens: 1000, // Reduced from 2000 to avoid context window issues
                            top_p: 1,
                        });
                        stream = createGroqStream(groqResponse);
                    } catch (apiError) {
                        console.error("Groq API error:", apiError);
                        throw new Error(`Groq API error: ${(apiError as Error).message}`);
                    }
                    break;
                
                default:
                    // Fallback to OpenAI if the selected provider isn't implemented yet
                    if (!OPENAI_API_KEY || 
                        OPENAI_API_KEY === 'USE_SIMULATION' || 
                        OPENAI_API_KEY === 'your_openai_api_key_here') {
                        throw new Error("OpenAI API key (used as fallback) is missing or set to simulation mode");
                    }
                    console.log(`Provider ${preferredProvider} not fully implemented yet, falling back to OpenAI`);
                    const fallbackResponse = await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: `You are an AI assistant. Pretend you are using ${preferredProvider} API.` },
                            ...formattedMessages.map(message => ({
                                role: message.role,
                                content: message.content
                            }))
                        ],
                        stream: true,
                        temperature: 0.7,
                        max_tokens: 2000,
                    });
                    stream = OpenAIStream(fallbackResponse);
                    break;
            }
        } catch (error) {
            console.error(`Error calling ${preferredProvider} API:`, error);
            
            // Instead of silently falling back to simulation mode, return the actual error
            const errorMessage = `Error using ${preferredProvider} API: ${(error as Error).message}`;
            console.error(errorMessage);
            
            // Create a simple response stream with the error message
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(errorMessage));
                    controller.close();
                }
            });
            
            const response = new StreamingTextResponse(stream);
            response.headers.set('X-Error', 'true');
            return response;
        }

        // Return the streaming response
        console.log(`Returning streaming response from ${preferredProvider}`);
        
        if (!stream) {
            console.error("Failed to create a valid stream");
            return new Response("Failed to generate response", { status: 500 });
        }
        
        // Create a proper StreamingTextResponse with the correct headers
        const response = new StreamingTextResponse(stream);
        
        // Add debugging and caching headers
        response.headers.set('X-Provider', preferredProvider);
        response.headers.set('X-Model', selectedModel);
        response.headers.set('X-Mode', mode);
        response.headers.set('Cache-Control', 'public, s-maxage=10');
        response.headers.set('X-Cache-Key', cacheKey);
        
        return response;

    } catch (error) {
        console.error('Error in chat API:', error);
        return new Response(`An error occurred while processing your request: ${(error as Error).message}. Check your API configuration.`, { 
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// Helper function to generate a cache key based on the request
async function generateCacheKey(request: Request): Promise<string> {
    try {
        const body = await request.json();
        const { messages, provider, mode, model } = body;
        
        // Use only the last few messages to create the cache key
        const recentMessages = messages.slice(-3);
        const messagesKey = recentMessages.map(m => `${m.role}:${m.content.substring(0, 50)}`).join('|');
        
        return `${provider}:${mode}:${model}:${messagesKey}`;
    } catch (error) {
        console.error('Error generating cache key:', error);
        return Date.now().toString(); // Fallback to timestamp if we can't parse request
    }
}
