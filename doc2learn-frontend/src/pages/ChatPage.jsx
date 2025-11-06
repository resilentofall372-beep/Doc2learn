// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assistantAPI, documentAPI } from '../services/api';
import ChatInterface from '../components/assistant/ChatInterface';
import QuickActions from '../components/assistant/QuickActions';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ChatPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const userId = localStorage.getItem('userId') || `user-${Date.now()}`;
  
  useEffect(() => {
    loadDocument();
  }, [documentId]);
  
  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await documentAPI.getDocument(documentId);
      setDocument(response.data.document);
      setError(null);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Failed to load document. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
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
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Document Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error || 'The document you\'re looking for doesn\'t exist.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <span className="mr-2">🤖</span>
                  AI Study Assistant
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {document.filename}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {document.file_type?.toUpperCase()}
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded-full">
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Quick Actions Sidebar */}
          <div className="lg:col-span-1">
            <QuickActions documentId={documentId} userId={userId} />
          </div>
          
          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <ChatInterface documentId={documentId} userId={userId} document={document} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
