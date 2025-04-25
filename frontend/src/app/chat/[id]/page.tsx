'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getChats, getChat, sendChatMessage, Chat, ChatSummary } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';

export default function ChatIdPage({ params }: { params: { id: string } }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Fetch chats and selected chat on initial load
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch the list of all chats
        const chatList = await getChats();
        setChats(chatList);
        
        // Fetch the current chat by ID
        const chat = await getChat(params.id);
        setCurrentChat(chat);
      } catch (error) {
        console.error('Error fetching data:', error);
        // If chat not found, redirect to main chat page
        router.push('/chat');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params.id, router]);
  
  // Handle new chat creation
  const handleNewChat = () => {
    setCurrentChat(null);
    router.push('/chat');
  };
  
  // Handle chat selection
  const handleChatSelect = async (chatId: string) => {
    // If same chat, do nothing
    if (chatId === params.id) return;
    
    router.push(`/chat/${chatId}`);
  };
  
  // Handle message submission
  const handleSendMessage = async (message: string) => {
    setLoading(true);
    
    try {
      const response = await sendChatMessage(
        message,
        currentChat?.chat_id,
        currentChat?.provider,
        currentChat?.model
      );
      
      // Update the current chat with the new message
      const updatedChat = await getChat(currentChat?.chat_id || response.chat_id);
      setCurrentChat(updatedChat);
      
      // Update the chat list
      const updatedChats = await getChats();
      setChats(updatedChats);
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