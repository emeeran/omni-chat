'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import RetryDialog from '@/components/RetryDialog';
import { Loader2, ChevronDown } from 'lucide-react';
import { 
  Chat, 
  ChatSummary, 
  getChat, 
  getChats, 
  deleteChat, 
  exportChat, 
  saveChat, 
  retryChat, 
  updateChatTitle,
  getProviders,
  getModels,
  Provider,
  Model
} from '@/lib/api';
import { saveAs } from 'file-saver';

export default function ChatPage({ params }: { params: { chatId?: string[] } }) {
  const router = useRouter();
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [pendingNewChat, setPendingNewChat] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [audioResponse, setAudioResponse] = useState(false);

  // Fetch chat list
  useEffect(() => {
    async function fetchChats() {
      try {
        const chatsList = await getChats();
        setChats(chatsList);
      } catch (error) {
        console.error('Error fetching chats:', error);
        // Continue with empty chat list, will be handled by the Sidebar fallback
        setChats([]);
      }
    }

    fetchChats();
  }, []);

  // Fetch specific chat or create a new one
  useEffect(() => {
    async function fetchOrCreateChat() {
      try {
        setIsLoading(true);
        setError(null);

        if (chatId) {
          try {
            const chat = await getChat(chatId);
            setCurrentChat(chat);
          } catch (error) {
            console.error('Error fetching chat:', error);
            setError('Failed to load the conversation. The chat may not exist or the server might be offline.');

            // Create a fallback chat if API is unavailable
            setCurrentChat({
              chat_id: chatId || `new-${Date.now()}`,
              title: 'New Conversation',
              messages: [],
              provider: 'openai',
              model: 'gpt-4o',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          // Create new chat client-side
          setCurrentChat({
            chat_id: `new-${Date.now()}`,
            title: 'New Conversation',
            messages: [],
            provider: 'openai',
            model: 'gpt-4o',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Error in chat initialization:', err);
        setError('An error occurred while initializing the chat.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrCreateChat();
  }, [chatId, router]);

  const handleNewChat = async () => {
    try {
      // Reset any pending states
      setShowSavePrompt(false);
      setPendingNewChat(false);
      
      console.log('Creating new chat - about to navigate to /chat');
      
      // Create a new chat by navigating to the root chat path
      // This will trigger the fetchOrCreateChat effect with no chatId
      router.push('/chat');
      
      console.log('Navigation to /chat completed');
    } catch (error) {
      console.error('Error creating new chat:', error);
      alert('Failed to create a new chat. Please try again.');
    }
  };

  const handleSaveConversation = async () => {
    if (!saveFileName.trim()) return;
    if (currentChat) {
      try {
        // First update the title on the backend
        const titleUpdateResult = await updateChatTitle(currentChat.chat_id, saveFileName.trim());
        
        if (!titleUpdateResult.success) {
          throw new Error("Failed to update chat title");
        }
        
        // Then save the chat
        const saveResult = await saveChat(currentChat.chat_id);
        
        if (!saveResult.success) {
          throw new Error("Failed to save chat");
        }
        
        // Update local state
        setCurrentChat({ ...currentChat, title: saveFileName.trim() });
        
        // Refresh the chat list
        const chatsList = await getChats();
        setChats(chatsList);
        
        // Close the dialog
        setShowSavePrompt(false);
        setSaveFileName('');
        
        // Navigate to new chat if needed
        if (pendingNewChat) {
          setPendingNewChat(false);
          router.push('/chat');
        }
      } catch (err) {
        console.error("Save conversation error:", err);
        alert('Failed to save chat. Please try again.');
      }
    }
  };

  const handleDeleteConversation = async () => {
    if (currentChat) {
      try {
        await deleteChat(currentChat.chat_id);
        setShowSavePrompt(false);
        setSaveFileName('');
        setPendingNewChat(false);
        router.push('/chat');
      } catch (err) {
        alert('Failed to delete chat.');
      }
    }
  };

  const handleChatSelect = (id: string) => {
    router.push(`/chat/${id}`);
  };

  const handleUpdateChat = (updatedChat: Chat) => {
    setCurrentChat(updatedChat);
  };

  // Add handler for deleting a chat
  const handleDeleteChat = async (id: string) => {
    try {
      const res = await deleteChat(id);
      if (res && res.success) {
        setChats((prev) => prev.filter((c) => c.chat_id !== id));
        if (currentChat && currentChat.chat_id === id) {
          handleNewChat();
        }
      } else {
        alert('Failed to delete chat.');
      }
    } catch (err) {
      alert('Failed to delete chat.');
    }
  };

  // Add handler for saving a chat
  const handleSaveChat = async (id: string) => {
    try {
      // Don't allow saving empty chats
      if (currentChat && (!currentChat.messages || currentChat.messages.length === 0)) {
        alert('There is nothing to save in this conversation yet.');
        return;
      }
      
      // Show the save prompt dialog
      setShowSavePrompt(true);
      
      // If the chat already has a title, use it as a starting point
      if (currentChat) {
        setSaveFileName(currentChat.title || '');
      }
    } catch (err) {
      console.error("Error opening save prompt:", err);
      alert('Failed to prepare chat for saving.');
    }
  };

  // Add handler for exporting a chat
  const handleExportChat = async (id: string, format: 'md' | 'pdf' | 'json') => {
    try {
      const data = await exportChat(id);
      if (!data) throw new Error('No data');
      
      if (format === 'json') {
        // JSON export
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, `chat-${data.title || 'conversation'}.json`);
      } else if (format === 'md') {
        // Markdown export
        let md = `# Conversation: ${data.title || 'Untitled'}\n\n`;
        data.messages.forEach((msg) => {
          if (msg.role === 'system') return; // Skip system messages in markdown export
          md += `**${msg.role === 'user' ? 'You' : 'AI'}:**\n`;
          md += `${msg.content}\n\n`;
        });
        const blob = new Blob([md], { type: 'text/markdown' });
        saveAs(blob, `chat-${data.title || 'conversation'}.md`);
      } else if (format === 'pdf') {
        // PDF export
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Please allow pop-ups to generate PDF');
          return;
        }
        
        let html = `
          <html>
          <head>
            <title>Chat Export - ${data.title || 'Untitled'}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #333; margin-bottom: 30px; }
              .message { margin-bottom: 30px; }
              .user { background-color: #f0f4f8; padding: 15px; border-radius: 8px; }
              .assistant { background-color: #edf2ff; padding: 15px; border-radius: 8px; }
              .role { font-weight: bold; margin-bottom: 8px; }
              .content { white-space: pre-wrap; }
              @media print {
                body { font-size: 12pt; }
                .message { page-break-inside: avoid; }
              }
            </style>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 500);
              }
            </script>
          </head>
          <body>
            <h1>Conversation: ${data.title || 'Untitled'}</h1>
        `;
        
        data.messages.forEach((msg) => {
          if (msg.role === 'system') return; // Skip system messages in PDF export
          html += `
            <div class="message ${msg.role}">
              <div class="role">${msg.role === 'user' ? 'You' : 'AI'}:</div>
              <div class="content">${msg.content}</div>
            </div>
          `;
        });
        
        html += `
          </body>
          </html>
        `;
        
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export chat.');
    }
  };

  // Add handler for retrying a chat
  const handleRetryChat = async (id: string) => {
    try {
      // Show the retry dialog if there's a current chat
      if (currentChat) {
        setShowRetryDialog(true);
      }
    } catch (err) {
      console.error('Error opening retry dialog:', err);
      alert('Failed to prepare chat for retrying.');
    }
  };

  // Add handler for executing the actual retry with selected provider and model
  const executeRetry = async (provider: string, model: string) => {
    try {
      setIsLoading(true);
      const result = await retryChat(currentChat!.chat_id, provider, model);
      
      if (result.success) {
        // Reload the chat data
        const updatedChat = await getChat(currentChat!.chat_id);
        setCurrentChat(updatedChat);
        // Refresh the chat list as well
        const chatsList = await getChats();
        setChats(chatsList);
      } else {
        alert('Failed to retry chat.');
      }
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      console.error('Error retrying chat:', err);
      alert('Failed to retry chat.');
    }
  };

  const handleExportMarkdown = () => {
    if (!currentChat) return;
    let md = `# Conversation: ${saveFileName || currentChat.title || 'Untitled'}\n\n`;
    currentChat.messages.forEach((msg) => {
      md += `**${msg.role === 'user' ? 'You' : 'AI'}:**\n`;
      md += `${msg.content}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const fileName = (saveFileName || currentChat.title || 'conversation') + '.md';
    saveAs(blob, fileName);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error && !currentChat) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error</h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => router.push('/chat')}
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
          >
            Start a New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        chats={chats}
        currentChatId={currentChat?.chat_id || ''}
        selectedModel={currentChat?.model || ''}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelect}
        onDeleteChat={handleDeleteChat}
        onSaveChat={handleSaveChat}
        onExportChat={handleExportChat}
        onRetryChat={handleRetryChat}
        onAudioResponseChange={setAudioResponse}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading conversation...</p>
          </div>
        ) : error ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-md text-center">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
              <button
                onClick={handleNewChat}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Start a New Chat
              </button>
            </div>
          </div>
        ) : currentChat ? (
          <ChatPanel 
            chat={currentChat} 
            onUpdateChat={handleUpdateChat}
            audioResponse={audioResponse}
          />
        ) : null}
      </main>

      {/* Retry Dialog */}
      {showRetryDialog && (
        <RetryDialog
          onClose={() => setShowRetryDialog(false)}
          onRetry={executeRetry}
        />
      )}

      {/* Save Prompt Dialog */}
      {showSavePrompt && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Save Conversation</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Enter a title for this conversation:
            </p>
            <input
              type="text"
              value={saveFileName}
              onChange={(e) => setSaveFileName(e.target.value)}
              placeholder="Conversation title"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowSavePrompt(false);
                  setSaveFileName('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConversation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                disabled={!saveFileName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}