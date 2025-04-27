// ChatMessages.jsx

const CodeBlock = React.memo(function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const isExecutable = ['bash', 'sh', 'shell', 'python', 'js', 'javascript', 'typescript', 'ts'].includes(language);
  const code = String(children).replace(/\n$/, '');

  const languageLabel = language ? language : 'text';

  // Reset copied state after 2 seconds
  React.useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
    });
  };

  const handleRunCode = () => {
    if (props.onRunCode) {
      props.onRunCode(code, language);
    }
  };

  // For inline code
  if (inline) {
    return (
      <code className="inline-code">
        {children}
      </code>
    );
  }

  // For code blocks
  return (
    <pre className="message-content-pre">
      <div className="code-header">
        <span className="code-language">{languageLabel}</span>
        <div className="code-actions">
          {isExecutable && (
            <button
              onClick={handleRunCode}
              className="code-btn"
              title="Run code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </button>
          )}
          <button
            onClick={handleCopyCode}
            className="code-btn"
            title="Copy code"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
      <code className="code-content" dangerouslySetInnerHTML={{ __html: hljs.highlight(code, { language: language || 'plaintext' }).value }}>
      </code>
    </pre>
  );
});

const MessageContent = React.memo(function MessageContent({ content }) {
  const processMarkdown = (text) => {
    // A very basic markdown processor for the example
    // In a real app, you'd use a full markdown library
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    
    let html = text
      // Process code blocks
      .replace(codeBlockRegex, (_, lang, code) => {
        return `<pre class="message-content-pre">
          <div class="code-header">
            <span class="code-language">${lang || 'text'}</span>
          </div>
          <code class="code-content">${code}</code>
        </pre>`;
      })
      // Process inline code
      .replace(inlineCodeRegex, '<code class="inline-code">$1</code>')
      // Process headers
      .replace(headerRegex, (_, level, text) => {
        const size = 7 - level.length; // h1 = 6, h2 = 5, etc.
        return `<h${level.length} class="text-${size}xl font-bold">${text}</h${level.length}>`;
      })
      // Convert line breaks to <br> tags
      .replace(/\n/g, '<br/>');
    
    return { __html: html };
  };

  return (
    <div className="message-content" dangerouslySetInnerHTML={processMarkdown(content)}>
    </div>
  );
});

// Single message component
const ChatMessage = React.memo(function ChatMessage({ message, onRunCode }) {
  // For very long messages, use a simpler preview
  const isLongMessage = message.content.length > 1000;
  const [isVisible, setIsVisible] = React.useState(false);
  
  // Simple intersection observer setup
  React.useEffect(() => {
    setIsVisible(true); // For simplicity, we'll just set it to true after a delay
  }, []);

  return (
    <div className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}>
      <div className={`message-avatar ${message.role === 'user' ? 'user-avatar' : 'assistant-avatar'}`}>
        {message.role === 'user' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="5"></circle>
            <path d="M20 21a8 8 0 1 0-16 0"></path>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8"></path>
            <rect x="2" y="2" width="20" height="8" rx="2"></rect>
            <path d="M2 14h20"></path>
            <path d="M2 20h20"></path>
          </svg>
        )}
      </div>
      <div className="message-bubble">
        <div className="message-header">
          <div className="message-sender">
            {message.role === 'user' ? 'You' : 'AI Assistant'}
          </div>
          <div className="message-time">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
        
        {(!isLongMessage || isVisible) ? (
          <MessageContent content={message.content} />
        ) : (
          // Simple preview for long messages that are not in view
          <div className="message-content opacity-70">
            {message.content.slice(0, 100)}...
            <span className="text-primary italic ml-2">(scrolling to view)</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Loading indicator component
const LoadingIndicator = function LoadingIndicator() {
  return (
    <div className="message assistant-message">
      <div className="message-avatar assistant-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8"></path>
          <rect x="2" y="2" width="20" height="8" rx="2"></rect>
          <path d="M2 14h20"></path>
          <path d="M2 20h20"></path>
        </svg>
      </div>
      <div className="message-bubble">
        <div className="message-header">
          <div className="message-sender">AI Assistant</div>
        </div>
        <div className="flex space-x-2 py-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: "0.15s"}}></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: "0.3s"}}></div>
        </div>
      </div>
    </div>
  );
};

// Welcome screen component
const WelcomeScreen = function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <h2 className="welcome-title">Welcome to OmniChat</h2>
      <p className="welcome-description">
        Start a conversation with AI using multiple providers and models. Customize your experience in the settings.
      </p>
    </div>
  );
};

// Chat messages container
const ChatMessages = React.memo(function ChatMessages({ messages, isLoading = false, onRunCode }) {
  const messagesEndRef = React.useRef(null);
  
  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Skip system messages
  const displayMessages = React.useMemo(
    () => messages.filter(msg => msg.role !== 'system'),
    [messages]
  );

  if (displayMessages.length === 0 && !isLoading) {
    return <WelcomeScreen />;
  }

  return (
    <div className="chat-messages">
      {displayMessages.map((message, index) => (
        <ChatMessage 
          key={message.id || index} 
          message={message} 
          onRunCode={onRunCode} 
        />
      ))}
      
      {isLoading && <LoadingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  );
}); 