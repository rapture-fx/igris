'use client';

import React, { useState, useCallback } from 'react';
import { Upload, File, X, Check, AlertCircle } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  uploadedAt: Date;
}

interface FileUploadProps {
  onFileUpload?: (files: UploadedFile[]) => void;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
}

export function FileUpload({ 
  onFileUpload,
  maxFileSize = 10,
  acceptedTypes = ['.csv', '.xlsx', '.xls', '.json'],
  className = ''
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return { valid: false, error: `File size must be less than ${maxFileSize}MB` };
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(fileExtension)) {
      return { valid: false, error: `Only ${acceptedTypes.join(', ')} files are allowed` };
    }

    return { valid: true };
  };

  const simulateUpload = (file: UploadedFile): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, progress: 100, status: 'success' }
                : f
            )
          );
          resolve();
        } else {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, progress }
                : f
            )
          );
        }
      }, 200);
    });
  };

  const processFiles = async (files: FileList) => {
    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach((file) => {
      const validation = validateFile(file);
      const uploadedFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        status: validation.valid ? 'uploading' : 'error',
        progress: validation.valid ? 0 : 0,
        uploadedAt: new Date()
      };
      
      newFiles.push(uploadedFile);
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Simulate upload for valid files
    const validFiles = newFiles.filter(f => f.status === 'uploading');
    setUploading(validFiles.length > 0);
    
    await Promise.all(validFiles.map(file => simulateUpload(file)));
    setUploading(false);
    
    if (onFileUpload) {
      onFileUpload(uploadedFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className={`mx-auto w-12 h-12 mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Drop your files here, or browse
        </h3>
        
        <p className="text-gray-600 mb-4">
          Supports: {acceptedTypes.join(', ')} (max {maxFileSize}MB)
        </p>
        
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        
        <label
          htmlFor="file-upload"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
        >
          <Upload className="w-4 h-4 mr-2" />
          Choose Files
        </label>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Uploaded Files ({uploadedFiles.length})
          </h4>
          
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <File className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.uploadedAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Status */}
                  {file.status === 'uploading' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(file.progress)}%</span>
                    </div>
                  )}
                  
                  {file.status === 'success' && (
                    <div className="flex items-center text-green-600">
                      <Check className="w-4 h-4 mr-1" />
                      <span className="text-xs">Complete</span>
                    </div>
                  )}
                  
                  {file.status === 'error' && (
                    <div className="flex items-center text-red-600">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      <span className="text-xs">Error</span>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 