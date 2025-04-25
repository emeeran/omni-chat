import { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, Search, AlertCircle, Loader2 } from 'lucide-react';
import { getDocuments, deleteDocument, DocumentMetadata } from '@/lib/api';
import DocumentUpload from './DocumentUpload';

type DocumentListProps = {
  onSelectDocument: (docId: string) => void;
};

export default function DocumentList({ onSelectDocument }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError('Failed to load documents. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this document?')) {
      setIsDeleting(docId);
      
      try {
        await deleteDocument(docId);
        setDocuments(documents.filter(doc => doc.doc_id !== docId));
      } catch (err) {
        console.error(err);
        alert('Failed to delete document');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleUploadSuccess = () => {
    fetchDocuments();
  };

  const filteredDocuments = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg shadow mb-4 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex justify-between items-center">
        <h3 className="font-medium text-lg">Documents</h3>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="p-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Upload
        </button>
      </div>
      
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-gray-300 dark:border-dark-600 rounded-md 
                      bg-gray-50 dark:bg-dark-700 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center p-6 text-gray-500 dark:text-gray-400">
            {documents.length === 0 ? (
              <p>No documents uploaded yet. Upload a document to use RAG.</p>
            ) : (
              <p>No documents match your search.</p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredDocuments.map((doc) => (
              <li 
                key={doc.doc_id}
                onClick={() => onSelectDocument(doc.doc_id)}
                className="bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 
                          p-3 rounded-md cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center min-w-0">
                  <FileText className="w-5 h-5 text-primary-500 mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.total_chunks} chunks · {Math.round(doc.total_chars / 1000)}K chars
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(doc.doc_id, e)}
                  disabled={isDeleting === doc.doc_id}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {isDeleting === doc.doc_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {showUploadModal && (
        <DocumentUpload 
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
} 