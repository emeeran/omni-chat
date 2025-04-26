'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Chat, ChatSummary, getChat, getChats, deleteChat, exportChat, saveChat, retryChat } from '@/lib/api';
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
    if (currentChat && currentChat.messages && currentChat.messages.length > 0) {
      setShowSavePrompt(true);
      setPendingNewChat(true);
      return;
    }
    router.push('/chat');
  };

  const handleSaveConversation = async () => {
    if (!saveFileName.trim()) return;
    if (currentChat) {
      try {
        // Update local state with new title
        setCurrentChat({ ...currentChat, title: saveFileName.trim() });
        // TODO: If needed, call an API to update the chat title in the backend here
        await saveChat(currentChat.chat_id);
        const chatsList = await getChats();
        setChats(chatsList);
        setShowSavePrompt(false);
        setSaveFileName('');
        if (pendingNewChat) {
          setPendingNewChat(false);
          router.push('/chat');
        }
      } catch (err) {
        alert('Failed to save chat.');
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
    alert('Chat saved!');
  };

  // Add handler for exporting a chat
  const handleExportChat = async (id: string) => {
    try {
      const data = await exportChat(id);
      if (!data) throw new Error('No data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveAs(blob, `chat-${id}.json`);
    } catch (err) {
      alert('Failed to export chat.');
    }
  };

  // Add handler for retrying a chat
  const handleRetryChat = async (id: string) => {
    // For now, just reload the page to retry
    window.location.reload();
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
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      <Sidebar
        chats={chats}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelect}
        onDeleteChat={handleDeleteChat}
        onSaveChat={handleSaveChat}
        onExportChat={handleExportChat}
        onRetryChat={handleRetryChat}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentChat && (
          <>
            {showSavePrompt && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
                  <h2 className="text-lg font-bold mb-2">Save Conversation</h2>
                  <input
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded mb-4 bg-white dark:bg-gray-800"
                    placeholder="Enter file name..."
                    value={saveFileName}
                    onChange={e => setSaveFileName(e.target.value)}
                  />
                  <div className="flex flex-wrap justify-end space-x-2">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={handleSaveConversation}
                      disabled={!saveFileName.trim()}
                    >
                      Save
                    </button>
                    <button
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      onClick={() => { setShowSavePrompt(false); setPendingNewChat(false); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      onClick={handleDeleteConversation}
                    >
                      Delete
                    </button>
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      onClick={handleExportMarkdown}
                    >
                      Export as Markdown
                    </button>
                  </div>
                </div>
              </div>
            )}
            <ChatPanel
              chat={currentChat}
              onUpdateChat={handleUpdateChat}
            />
          </>
        )}
      </main>
    </div>
  );
}