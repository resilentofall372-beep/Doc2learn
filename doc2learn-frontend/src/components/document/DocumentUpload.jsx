// src/components/document/DocumentUpload.jsx - UPDATED
import React, { useState } from 'react';
import { documentAPI } from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

const DocumentUpload = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { addNotification } = useApp();
  const { user } = useAuth();

  const handleFile = async (file) => {
    if (!file) return;

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      addNotification({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Please upload PDF, DOCX, PPTX, TXT, or image files only.'
      });
      return;
    }

    // Check file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
      addNotification({
        type: 'error',
        title: 'File Too Large',
        message: 'Please upload files smaller than 16MB.'
      });
      return;
    }

    setUploading(true);
    
    try {
      console.log('📤 Starting upload for user:', user?.user_id);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user?.user_id || 'default-user');

      const response = await documentAPI.uploadDocument(formData);
      
      console.log('✅ Upload successful:', response.data);
      
      addNotification({
        type: 'success',
        title: 'Upload Successful',
        message: 'Document processed and stored successfully!'
      });

      if (onUpload) {
        onUpload({
          _id: response.data.document_id,
          doc_id: response.data.document_id,
          filename: file.name,
          uploaded_on: new Date().toISOString(),
          text: response.data.text,
          user_id: user?.user_id
        });
      }

    } catch (error) {
      console.error('❌ Upload failed:', error);
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: error.response?.data?.error || 'Failed to upload document'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <LoadingSpinner size="medium" />
            <p className="mt-4 text-gray-600">Processing document...</p>
            <p className="text-sm text-gray-500">This may take a few moments</p>
          </div>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="flex text-sm text-gray-600 justify-center">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleChange}
                  accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png"
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              PDF, DOCX, PPTX, TXT, JPG, PNG up to 16MB
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;