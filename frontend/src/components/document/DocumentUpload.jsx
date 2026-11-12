import React, { useState } from 'react';
import { documentAPI, errorMessage } from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { UPLOAD_CONFIG } from '../../utils/constants';
import LoadingSpinner from '../common/LoadingSpinner';

const extensionOf = (name) => `.${(name.split('.').pop() || '').toLowerCase()}`;

const DocumentUpload = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { addNotification } = useApp();

  const handleFile = async (file) => {
    if (!file) return;
    if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      addNotification({
        type: 'error',
        title: 'Unsupported file',
        message: `Use ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`,
      });
      return;
    }
    if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
      addNotification({ type: 'error', title: 'File too large', message: 'Files must be under 16MB.' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await documentAPI.uploadDocument(formData);
      const { document, warnings } = response.data;
      addNotification({
        type: 'success',
        title: 'Document ready',
        message: `${document.filename}: ${document.chunk_count} sections indexed`,
      });
      (warnings || []).forEach((w) => addNotification({ type: 'info', title: 'Note', message: w }));
      onUpload?.(document);
    } catch (error) {
      addNotification({ type: 'error', title: 'Upload failed', message: errorMessage(error) });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {uploading ? (
        <div className="flex flex-col items-center">
          <LoadingSpinner size="medium" />
          <p className="mt-4 text-gray-600">Reading and indexing your document…</p>
          <p className="text-sm text-gray-500">Large PDFs can take up to a minute.</p>
        </div>
      ) : (
        <>
          <div className="text-4xl mb-3">📤</div>
          <div className="flex text-sm text-gray-600 justify-center">
            <label htmlFor="file-upload" className="cursor-pointer font-medium text-primary-600 hover:text-primary-500">
              <span>Choose a file</span>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
                accept={UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(',')}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">PDF, DOCX, PPTX, TXT, MD, PNG or JPG up to 16MB</p>
        </>
      )}
    </div>
  );
};

export default DocumentUpload;
