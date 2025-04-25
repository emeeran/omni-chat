'use client';

import { useState } from 'react';
import DocumentList from '@/components/DocumentList';
import { getDocumentContent } from '@/lib/api';

export default function DocumentsPage() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectDocument = async (docId: string) => {
    if (docId === selectedDocId) return;
    
    setSelectedDocId(docId);
    setLoading(true);
    setError(null);
    
    try {
      const { content } = await getDocumentContent(docId);
      setDocumentContent(content);
    } catch (err) {
      console.error(err);
      setError('Failed to load document content.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-dark-700 h-full">
        <DocumentList onSelectDocument={handleSelectDocument} />
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedDocId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Select a Document</h2>
            <p className="text-gray-500 max-w-md">
              Choose a document from the list to view its content.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex space-x-2 animate-pulse">
              <div className="h-3 w-3 bg-primary-500 rounded-full"></div>
              <div className="h-3 w-3 bg-primary-500 rounded-full"></div>
              <div className="h-3 w-3 bg-primary-500 rounded-full"></div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 dark:bg-dark-700 p-4 rounded-md overflow-auto">
              {documentContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 