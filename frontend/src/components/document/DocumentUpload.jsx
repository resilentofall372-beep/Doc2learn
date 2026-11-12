import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { documentAPI, errorMessage } from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { UPLOAD_CONFIG } from '../../utils/constants';
import LoadingSpinner from '../common/LoadingSpinner';

const extensionOf = (name) => `.${(name.split('.').pop() || '').toLowerCase()}`;

const DocumentUpload = ({ projectId, onUpload, compact = false }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const { addNotification } = useApp();

  const handleFile = async (file) => {
    if (!file) return;
    if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      addNotification({ type: 'error', title: 'Unsupported file type', message: 'Use PDF, DOCX, PPTX, TXT, MD, PNG or JPG.' });
      return;
    }
    if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
      addNotification({ type: 'error', title: 'File too large', message: 'Files must be under 16 MB.' });
      return;
    }
    setUploading(true);
    try {
      const res = await documentAPI.upload(projectId, file);
      const { document, warnings } = res.data;
      addNotification({ type: 'success', title: 'Document ready', message: `${document.filename} is indexed and ready to study.` });
      (warnings || []).forEach((w) => addNotification({ type: 'info', title: 'Note', message: w }));
      onUpload?.(document);
    } catch (error) {
      addNotification({ type: 'error', title: 'Upload failed', message: errorMessage(error) });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  return (
    <div
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={(e) => {
        onDrag(e);
        setDragActive(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${
        compact ? 'px-6 py-6' : 'px-6 py-10'
      } ${
        dragActive
          ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-500/10'
          : 'border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
      }`}
    >
      {uploading ? (
        <>
          <LoadingSpinner size="medium" />
          <p className="mt-3 text-sm font-medium">Reading and indexing…</p>
          <p className="muted mt-1 text-xs">Large PDFs can take up to a minute.</p>
        </>
      ) : (
        <>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm">
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              Choose a file
            </button>
            <span className="muted"> or drag it here</span>
          </p>
          <p className="muted mt-1 text-xs">PDF, DOCX, PPTX, TXT, MD, PNG or JPG · up to 16 MB</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(',')}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </>
      )}
    </div>
  );
};

export default DocumentUpload;
