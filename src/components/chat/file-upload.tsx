'use client';

import { useRef, useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'; // Use available icon
import { ChatMode } from '@/lib/utils';

interface FileUploadProps {
    mode: ChatMode;
    onFileUpload: (file: File) => void;
    disabled?: boolean;
}

export function FileUpload({ mode, onFileUpload, disabled = false }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Allowed file types based on mode
    const getAllowedFileTypes = () => {
        switch (mode) {
            case 'document':
                return '.pdf,.doc,.docx,.txt';
            case 'image':
                return 'image/*';
            case 'audio':
                return 'audio/*';
            default:
                return '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            onFileUpload(selectedFile);

            // Create preview for images
            if (mode === 'image' && selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setPreview(event.target?.result as string);
                };
                reader.readAsDataURL(selectedFile);
            }
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Show upload UI only for relevant modes
    if (!['document', 'image', 'audio'].includes(mode)) {
        return null;
    }

    return (
        <div className="p-2 border-t border-border">
            {!file ? (
                <div
                    className={`relative border-2 border-dashed rounded-lg p-4 text-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                        }`}
                    onClick={() => !disabled && fileInputRef.current?.click()}
                >
                    <UploadIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                        {mode === 'document' && 'Upload a document'}
                        {mode === 'image' && 'Upload an image or click to browse'}
                        {mode === 'audio' && 'Upload an audio file'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {mode === 'document' && 'PDF, DOC, DOCX, TXT up to 10MB'}
                        {mode === 'image' && 'JPG, PNG, GIF up to 5MB'}
                        {mode === 'audio' && 'MP3, WAV up to 5MB'}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={getAllowedFileTypes()}
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={disabled}
                    />
                </div>
            ) : (
                <div className="relative bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center">
                        {preview && (
                            <div className="w-16 h-16 mr-3 rounded overflow-hidden flex-shrink-0">
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            onClick={handleRemoveFile}
                            className="ml-2 p-1 rounded-full hover:bg-muted"
                            disabled={disabled}
                        >
                            <XMarkIcon className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
