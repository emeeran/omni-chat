'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getChats, getChat, sendChatMessage, Chat, ChatSummary } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';

export default function ChatPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Fetch chats on initial load
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const chatList = await getChats();
        setChats(chatList);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };
    
    fetchChats();
  }, []);
  
  // Handle new chat creation
  const handleNewChat = () => {
    setCurrentChat(null);
    router.push('/chat');
  };
  
  // Handle chat selection
  const handleChatSelect = async (chatId: string) => {
    try {
      const chat = await getChat(chatId);
      setCurrentChat(chat);
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };
  
  // Handle message submission
  const handleSendMessage = async (message: string) => {
    setLoading(true);
    
    try {
      const response = await sendChatMessage(
        message,
        currentChat?.chat_id,
        currentChat?.provider || 'groq',
        currentChat?.model
      );
      
      // If this is a new chat, push to the chat page with the new ID
      if (!currentChat && response.chat_id) {
        router.push(`/chat/${response.chat_id}`);
        
        // Fetch the full chat to get all messages
        const newChat = await getChat(response.chat_id);
        setCurrentChat(newChat);
        
        // Update the chat list
        const updatedChats = await getChats();
        setChats(updatedChats);
      } else if (currentChat) {
        // Update the current chat with the new message
        const updatedChat = await getChat(currentChat.chat_id);
        setCurrentChat(updatedChat);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        chats={chats} 
        onNewChat={handleNewChat} 
        onChatSelect={handleChatSelect} 
      />
      
      <div className="flex-1 flex flex-col">
        <ChatMessages 
          messages={currentChat?.messages || []} 
          isLoading={loading} 
        />
        <ChatInput 
          onSubmit={handleSendMessage} 
          isLoading={loading} 
        />
      </div>
    </div>
  );
} 