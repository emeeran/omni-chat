# Technical Context

## Technology Stack

### Frontend
- **Framework**: Next.js 14
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **State Management**: React Hooks (useState, useEffect, useMemo)
- **Code Quality**: TypeScript, ESLint

### Backend
- **API Routes**: Next.js API Routes
- **Streaming**: Web Streams API
- **AI Integration**: Provider-specific SDKs

### Integrations
| Provider | SDK/Package | API Key Environment Variable |
|----------|-------------|------------------------------|
| OpenAI | openai | OPENAI_API_KEY |
| Anthropic | @anthropic-ai/sdk | ANTHROPIC_API_KEY |
| Groq | groq-sdk | GROQ_API_KEY |
| Mistral | (API calls) | MISTRAL_API_KEY |
| DeepSeek | (API calls) | DEEPSEEK_API_KEY |
| Cohere | (API calls) | COHERE_API_KEY |
| DashScope | (API calls) | DASHSCOPE_API_KEY |
| Hugging Face | (API calls) | HF_ACCESS_TOKEN |

## Development Setup
- Node.js environment
- Local environment variables (.env.local)
- npm for package management

## Project Structure
```
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── api/         # API routes
│   │   │   └── chat/    # Chat API endpoint
│   │   ├── globals.css  # Global styles
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main page component
│   ├── components/      # React components
│   │   ├── chat/        # Chat-related components
│   │   └── ui/          # UI components
│   ├── lib/             # Utility functions and types
│   │   ├── providers/   # Provider-specific implementations
│   │   └── utils/       # General utilities
│   └── styles/          # Additional styles
├── .env.example         # Example environment variables
├── .env.local           # Local environment variables (gitignored)
├── next.config.js       # Next.js configuration
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Dependencies

### Core Dependencies
- next: ^14.1.0
- react: ^18.2.0
- react-dom: ^18.2.0
- ai: ^2.2.33

### AI Provider SDKs
- @anthropic-ai/sdk: ^0.39.0
- groq-sdk: ^0.19.0
- openai: ^4.92.1

### UI and Styling
- @heroicons/react: ^2.1.1
- @radix-ui/react-dialog: ^1.0.5
- @radix-ui/react-dropdown-menu: ^2.0.6
- @radix-ui/react-slider: ^1.1.2
- framer-motion: ^11.0.3
- lucide-react: ^0.340.0
- tailwindcss: ^3.4.1

### Utilities
- react-markdown: ^9.0.1
- react-syntax-highlighter: ^15.6.1
- uuid: ^9.0.1

## Technical Constraints
- API rate limits from providers
- Token limits per request from AI models
- Browser storage limitations for chat history 