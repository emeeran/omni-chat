// App.jsx

const App = function App() {
  const [messages, setMessages] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Apply dark mode class to body
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  // Toggle theme
  const handleToggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };
  
  // Start a new chat
  const handleNewChat = () => {
    setMessages([]);
  };
  
  // Send message to API
  const handleSendMessage = async (content) => {
    if (!content.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    
    try {
      // In a real app, this would be an API call
      // For demo purposes, we'll simulate a response after a delay
      setTimeout(() => {
        const botMessage = {
          role: 'assistant',
          content: `I received your message: "${content}"\n\nHere's a code example:\n\n\`\`\`javascript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n\`\`\``,
          created_at: new Date().toISOString()
        };
        
        setMessages((prevMessages) => [...prevMessages, botMessage]);
        setIsLoading(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      
      // Add error message
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        created_at: new Date().toISOString()
      };
      
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };
  
  // Handle code execution
  const handleRunCode = (code, language) => {
    console.log(`Running ${language} code:`, code);
    // In a real app, this would send the code to a backend for execution
    // For demo purposes, we'll just add a message
    
    const resultMessage = {
      role: 'assistant',
      content: `Code execution requested for:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nOutput:\n\`\`\`\nCode execution is simulated in this demo.\n\`\`\``,
      created_at: new Date().toISOString()
    };
    
    setMessages((prevMessages) => [...prevMessages, resultMessage]);
  };
  
  return (
    <div className="app-container">
      <Sidebar 
        onNewChat={handleNewChat} 
        onToggleTheme={handleToggleTheme}
        isDarkMode={isDarkMode}
      />
      
      <div className="main-content">
        <div className="chat-container">
          <ChatMessages 
            messages={messages} 
            isLoading={isLoading} 
            onRunCode={handleRunCode}
          />
          
          <ChatInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}; 