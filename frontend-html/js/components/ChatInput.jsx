// ChatInput.jsx

const ChatInput = React.memo(function ChatInput({ onSendMessage, isLoading = false }) {
  const [message, setMessage] = React.useState('');
  const textareaRef = React.useRef(null);

  // Auto-resize textarea based on content
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Handle input change
  const handleChange = (e) => {
    setMessage(e.target.value);
  };

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  // Handle key press (Ctrl/Cmd + Enter to submit)
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isLoading}
          rows={1}
        />
        <button 
          type="submit" 
          className="send-button" 
          disabled={!message.trim() || isLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
      <div className="text-xs text-center mt-2 text-gray-500">
        Press Ctrl + Enter to send
      </div>
    </div>
  );
}); 