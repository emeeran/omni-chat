import { useState } from 'react';
import { Upload, X, FileText, AlertCircle, Check } from 'lucide-react';
import { uploadDocument } from '@/lib/api';

type DocumentUploadProps = {
  onUploadSuccess?: (docId: string) => void;
  onClose: () => void;
};

export default function DocumentUpload({ onUploadSuccess, onClose }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      handleFileSelection(selectedFile);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    // Check if file type is allowed
    const allowedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      return;
    }
    
    // Check file size (limit to 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const response = await uploadDocument(file);
      
      setUploadSuccess(true);
      
      if (onUploadSuccess) {
        onUploadSuccess(response.doc_id);
      }
      
      // Auto-close after 1.5 seconds on success
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold">Upload Document</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-300 dark:border-dark-600'
            } ${file ? 'bg-gray-50 dark:bg-dark-700/50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!file ? (
              <>
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Drag and drop your document here or
                  <label className="ml-1 text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.doc,.docx,.pdf"
                      onChange={handleFileInput}
                    />
                  </label>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Supported formats: TXT, MD, DOC, DOCX, PDF (Max 10MB)
                </p>
              </>
            ) : (
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-primary-500 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {uploadSuccess && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md flex items-center">
              <Check className="w-5 h-5 mr-2" />
              <p className="text-sm">Document uploaded successfully!</p>
            </div>
          )}
          
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-dark-600 rounded-md hover:bg-gray-50 dark:hover:bg-dark-700"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`px-4 py-2 text-sm rounded-md text-white ${
                !file || isUploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 