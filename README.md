# Omni Chat - Multi-Modal AI Chat Application

Omni Chat is a robust chat application built with the Vercel AI SDK, featuring an ultra-modern UI/UX and support for multiple chat modes and AI providers.

## Features

- **Multiple Chat Modes**:
  - Default Text Chat
  - RAG (Retrieval Augmented Generation)
  - Document Chat
  - Image Generation/Analysis
  - Audio Processing

- **Multiple AI Providers**:
  - OpenAI
  - Anthropic
  - Groq
  - Mistral
  - Fireworks
  - Google AI

- **Modern UI/UX**:
  - Responsive design
  - Dark/Light mode
  - Beautiful animations
  - Markdown support
  - File upload functionality

- **Session Management**:
  - Create multiple chat sessions
  - Switch between conversations
  - Name and organize chats
  - Delete unwanted chats

## Getting Started

### Prerequisites

- Node.js 16.8.0 or later
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/omni-chat.git
   cd omni-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables by copying the example file:
   ```bash
   cp .env.example .env.local
   ```

4. Edit `.env.local` and add your API keys from the respective providers:
   - OpenAI: https://platform.openai.com/account/api-keys
   - Anthropic: https://console.anthropic.com/account/keys
   - Groq: https://console.groq.com/keys

5. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Select a Chat Mode**: Choose from Default, RAG, Document, Image, or Audio modes
2. **Choose an AI Provider**: Select from OpenAI, Anthropic, Groq, Mistral, Fireworks, or Google
3. **Start Chatting**: Type your message and press Enter
4. **Upload Files**: In Document, Image, or Audio modes, you can upload relevant files
5. **Manage Conversations**: Create new chats, switch between existing chats, or delete chats

## Technologies Used

- [Next.js](https://nextjs.org/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)

## Future Enhancements

- Persistent storage using a database
- User authentication and profiles
- Enhanced RAG capabilities with vector databases
- Voice chat integration
- Mobile application

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Using Actual AI Providers vs. Simulation Mode

### Actual AI Providers

To use actual AI providers, you need to get API keys from their respective platforms and add them to your `.env.local` file. Each provider requires its own API key:

- For OpenAI: Get your API key from https://platform.openai.com/account/api-keys
- For Anthropic: Get your API key from https://console.anthropic.com/account/keys
- For Groq: Get your API key from https://console.groq.com/keys

### Simulation Mode

If you don't have API keys or want to test the application without making API calls:

1. Set `OPENAI_API_KEY=USE_SIMULATION` in your `.env.local` file
2. The application will use a simulated response generator instead of calling the actual AI APIs

Note: Simulated responses are not AI-generated and are just for demonstration purposes.

## Troubleshooting

### Responses Not Displayed

If responses are not being displayed:

1. Check your browser console for any errors
2. Verify your API keys are correctly set in the `.env.local` file
3. Make sure you have sufficient credits/quota on your AI provider account

### API Rate Limits

If you encounter rate limit errors:

1. Switch to a different provider
2. Wait a few minutes before trying again
3. Check your usage quota on the provider's dashboard