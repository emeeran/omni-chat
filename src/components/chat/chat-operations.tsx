import React, { useState } from 'react';
import { ChatSession } from '@/types/chat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BookmarkIcon,
  FolderOpenIcon,
  TrashIcon,
  ArrowPathIcon,
  PlusIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface ChatOperationsProps {
  activeChat: ChatSession | null;
  onSave: (chat: ChatSession) => void;
  onLoad: (chat: ChatSession) => void;
  onDelete: (chatId: string) => void;
  onRetry: () => void;
  onNew: () => void;
  onExport: () => void;
}

export function ChatOperations({
  activeChat,
  onSave,
  onLoad,
  onDelete,
  onRetry,
  onNew,
  onExport,
}: ChatOperationsProps) {
  const [savedChats, setSavedChats] = useState<ChatSession[]>([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load saved chats from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('savedChats');
    if (saved) {
      try {
        setSavedChats(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved chats:', error);
      }
    }
  }, []);

  // Save chat
  const handleSave = () => {
    if (!activeChat) return;

    const updatedSavedChats = [...savedChats, { ...activeChat, savedAt: new Date() }];
    localStorage.setItem('savedChats', JSON.stringify(updatedSavedChats));
    setSavedChats(updatedSavedChats);
    onSave(activeChat);
  };

  // Load chat
  const handleLoad = (chat: ChatSession) => {
    onLoad(chat);
    setShowLoadDialog(false);
  };

  // Delete chat
  const handleDelete = () => {
    if (!activeChat) return;
    
    // Remove from saved chats if it exists there
    const updatedSavedChats = savedChats.filter(chat => chat.id !== activeChat.id);
    localStorage.setItem('savedChats', JSON.stringify(updatedSavedChats));
    setSavedChats(updatedSavedChats);
    
    onDelete(activeChat.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* First row: New, Retry, Save */}
      <div className="flex justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onNew}
          className="h-8 w-8"
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRetry}
          disabled={!activeChat || activeChat.messages.length < 2}
          className="h-8 w-8"
          title="Retry Last Response"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={!activeChat}
          className="h-8 w-8"
          title="Save Chat"
        >
          <BookmarkIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Second row: Export, Load, Delete */}
      <div className="flex justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExport}
          disabled={!activeChat}
          className="h-8 w-8"
          title="Export Chat"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </Button>

        <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Load Chat"
            >
              <FolderOpenIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load Saved Chat</DialogTitle>
              <DialogDescription>
                Select a chat to load from your saved chats
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {savedChats.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No saved chats found
                </p>
              ) : (
                <div className="space-y-2">
                  {savedChats.map((chat) => (
                    <Button
                      key={chat.id}
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => handleLoad(chat)}
                    >
                      <div>
                        <div className="font-medium">{chat.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(chat.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!activeChat}
              className="h-8 w-8"
              title="Delete Chat"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Chat</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this chat? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 