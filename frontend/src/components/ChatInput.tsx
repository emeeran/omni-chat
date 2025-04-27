import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';

type ChatInputProps = {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
};

export default function ChatInput({ onSubmit, isLoading = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    onSubmit(message);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle file attachment
  const handleAttachmentClick = () => {
    // Trigger file input click
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For now, we'll just add the filename to the message
    // In a real implementation, you would upload the file to the server
    const file = files[0];
    setMessage((prev) => {
      const newMessage = prev.trim() ? `${prev}\n\nAttaching file: ${file.name}` : `Attaching file: ${file.name}`;
      return newMessage;
    });

    // Reset file input so the same file can be selected again if needed
    e.target.value = '';

    // Focus the textarea
    textareaRef.current?.focus();
  };

  // Handle voice input
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    setIsRecording(!isRecording);

    // In a real implementation, you would use the Web Speech API
    // This is a simplified simulation
    if (!isRecording) {
      alert('Voice recording started (simulated). Click the mic button again to stop.');
      // In a real implementation, you would start recording here
    } else {
      alert('Voice recording stopped (simulated). The transcript would be added to your message.');
      // In a real implementation, you would process the recording here
      setMessage((prev) => {
        const newMessage = prev.trim() ? `${prev}\n\n[Voice input would appear here]` : `[Voice input would appear here]`;
        return newMessage;
      });
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-dark-700 p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-shrink-0">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700"
            title="Attach file"
            onClick={handleAttachmentClick}
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full border border-gray-300 dark:border-dark-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-white dark:bg-dark-800"
            disabled={isLoading}
          />
        </div>

        <div className="flex-shrink-0 flex space-x-2">
          <button
            type="button"
            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 ${isRecording ? 'bg-red-100 text-red-500' : ''
              }`}
            title="Voice input"
            onClick={handleVoiceInput}
          >
            <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500' : 'text-gray-500'}`} />
          </button>

          <button
            type="submit"
            className={`p-2 rounded-full ${!message.trim() || isLoading
                ? 'bg-gray-200 dark:bg-dark-700 text-gray-500'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            disabled={!message.trim() || isLoading}
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}