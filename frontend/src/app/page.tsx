'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProviders, getModels } from '@/lib/api';
import { RefreshCw } from 'lucide-react';

type ApiStatus = 'checking' | 'online' | 'offline';

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [backendMessage, setBackendMessage] = useState('');
  const router = useRouter();
  
  // Check if backend API is available
  useEffect(() => {
    async function checkApiStatus() {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        setApiStatus(data.status as ApiStatus);
        setBackendMessage(data.message);
      } catch (error) {
        console.error('Error checking API status:', error);
        setApiStatus('offline');
        setBackendMessage('Could not connect to health check endpoint');
      }
    }
    
    checkApiStatus();
    
    // Auto-redirect to /chat after a short delay
    const redirectTimer = setTimeout(() => {
      router.push('/chat');
    }, 3000);
    
    return () => clearTimeout(redirectTimer);
  }, [router]);
  
  const handleRetry = async () => {
    setApiStatus('checking');
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      setApiStatus(data.status as ApiStatus);
      setBackendMessage(data.message);
    } catch (error) {
      console.error('Error checking API status:', error);
      setApiStatus('offline');
      setBackendMessage('Could not connect to health check endpoint');
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-dark-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">OmniChat</h1>
        
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Welcome to OmniChat! This application allows you to chat with various AI models through different providers.
          </p>
          
          {apiStatus === 'checking' && (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              <span className="ml-3 text-sm text-gray-500">Checking API status...</span>
            </div>
          )}
          
          {apiStatus === 'offline' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200 p-3 rounded-md text-sm mb-4">
              <p className="font-medium">Backend API is unavailable</p>
              <p className="mt-1">{backendMessage}</p>
              <p className="mt-2 text-xs">The application will use fallback data.</p>
              <button 
                className="mt-2 flex items-center justify-center mx-auto text-amber-700 dark:text-amber-300 hover:underline"
                onClick={handleRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                <span>Retry connection</span>
              </button>
            </div>
          )}
          
          {apiStatus === 'online' && (
            <div className="bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200 p-3 rounded-md text-sm mb-4">
              <p className="font-medium">Backend API is available</p>
              <p className="mt-1">{backendMessage}</p>
            </div>
          )}
          
          <p className="mt-4 text-sm text-gray-500">Redirecting to chat interface in a moment...</p>
        </div>
        
        <div className="flex flex-col space-y-3">
          <Link 
            href="/chat"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center font-medium"
          >
            Start a new chat
          </Link>
        </div>
      </div>
      
      <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        <p>Set up with fallback model data when backend is unavailable</p>
      </div>
    </div>
  );
} 