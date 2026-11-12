import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { documentAPI, errorMessage } from '../services/api';
import ChatInterface from '../components/assistant/ChatInterface';
import QuickActions from '../components/assistant/QuickActions';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ChatPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await documentAPI.getDocument(documentId);
      setDocument(res.data.document);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load document'));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">📄</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Document unavailable</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || 'This document does not exist.'}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                aria-label="Back to dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study tutor</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{document.filename}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              <div>{document.page_count} page{document.page_count === 1 ? '' : 's'} · {document.chunk_count} sections</div>
              <div>Answers cite pages and say when the document does not cover something.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <QuickActions documentId={documentId} />
          </div>
          <div className="lg:col-span-3">
            <ChatInterface documentId={documentId} document={document} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
