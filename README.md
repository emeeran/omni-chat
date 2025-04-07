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

3. Set up environment variables:
   Create a `.env.local` file in the root directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   MISTRAL_API_KEY=your_mistral_api_key_here
   FIREWORKS_API_KEY=your_fireworks_api_key_here
   GOOGLE_AI_API_KEY=your_google_ai_api_key_here
   ```

4. Run the development server:
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