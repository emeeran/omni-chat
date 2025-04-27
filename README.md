# OmniChat

A versatile chat interface for interacting with multiple AI providers through a unified, feature-rich experience.

![OmniChat](https://via.placeholder.com/800x400?text=OmniChat+Interface)

## Overview

OmniChat provides a seamless interface to interact with various AI models from different providers. It offers advanced customization, persistent settings, and a wide range of tools to enhance your AI conversations.

## Features

### Core Functionality

- **Multi-Provider Support**: Connect with models from OpenAI, Anthropic, Mistral AI, Google AI, and Cohere through a unified interface
- **Responsive UI**: Clean, modern interface with dark/light mode support
- **Persistent Settings**: Your preferences and API keys are saved locally for convenience
- **Conversation Management**: Create, save, load, and delete conversations

### Chat Interface

- **Real-time Messaging**: Send messages and receive AI responses in real-time
- **Pagination**: Navigate through longer conversations with built-in pagination
- **Provider/Model Information**: Each message displays which provider and model generated the response
- **Message Retry**: Regenerate responses for any message
- **Error Handling**: Fallback mode when backend is unavailable

### AI Configuration

- **Provider Selection**: Choose from multiple AI providers
- **Model Selection**: Pick specific models with detailed capability information
  - Visual indicators for model capabilities (vision, chat, etc.)
  - Economic model indicators
- **Persona Selection**: Set different AI personas for various conversation styles
- **Mode Selection**: Toggle between Chat, RAG (Retrieval Augmented Generation), and Image modes
- **Max Tokens**: Adjust response length with visual slider and quick presets
  - Quick presets for 2000, 4000, and 8000 tokens
- **Temperature Control**: Fine-tune AI creativity with visual slider
- **Voice Response**: Toggle audio responses on/off

### Advanced Settings

- **System Prompt**: Customize AI behavior with custom system instructions
- **Context Window**: Control how much conversation history the AI considers
- **API Key Management**: 
  - Securely add, edit, and remove API keys for different providers
  - Support for OpenAI, Anthropic, Mistral AI, Google AI, Cohere, and custom providers

### AI Plugins

- **Web Search**: Allow the AI to search the web for current information
- **Code Interpreter**: Execute code snippets directly within the chat
- **Image Generator**: Create images based on text descriptions
- **File Analysis**: Upload and analyze files with AI assistance

### Export Options

- **Markdown Export**: Save conversations in markdown format
- **PDF Export**: Generate PDF documents of your conversations
- **JSON Export**: Export conversations in JSON format for programmatic use

### User Experience

- **Keyboard Shortcuts**: Quick navigation with keyboard shortcuts (Ctrl+K/Cmd+K for search)
- **Collapsible Sidebar**: Toggle between full and minimized sidebar for more chat space
- **Search**: Find previous conversations quickly
- **Animations**: Smooth transitions and animations for a polished feel
- **Loading States**: Visual feedback during API calls and data loading
- **Error Handling**: Graceful error displays with recovery options

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/omni-chat.git

# Navigate to the project directory
cd omni-chat

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Configuration

OmniChat requires API keys for the AI providers you wish to use. Add these through the API Keys section in Advanced Settings.

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Usage

### Starting a New Chat

1. Click the "New" button in the sidebar
2. Select your desired AI provider and model in the Settings tab
3. Start typing your message in the input field
4. Press Enter or click the send button

### Customizing AI Behavior

1. Navigate to the Settings tab
2. Adjust parameters like temperature, max tokens, and persona
3. For advanced options, click the gear icon to access Advanced Settings

### Managing Conversations

- **Save**: Save your current conversation
- **Load**: Browse and load previous conversations
- **Delete**: Remove unwanted conversations
- **Export**: Export conversations in various formats

### Using Plugins

1. Open Advanced Settings from the gear icon
2. Enable desired plugins under the AI Plugins section
3. Use them within your conversations as needed

## Development

### Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: TailwindCSS
- **Icons**: Lucide Icons
- **State Management**: React Hooks

### Project Structure

- `/frontend`: Front-end Next.js application
  - `/src/components`: React components
  - `/src/lib`: Utility functions and API definitions
  - `/public`: Static assets

## License

[MIT License](LICENSE)

## Acknowledgements

- Built with [Next.js](https://nextjs.org/)
- Icons from [Lucide](https://lucide.dev/)
- UI components styled with [TailwindCSS](https://tailwindcss.com/) 