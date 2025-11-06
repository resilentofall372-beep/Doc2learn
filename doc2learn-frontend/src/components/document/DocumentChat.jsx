// src/components/document/DocumentChat.jsx - Q&A with Documents using RAG
import React, { useState } from 'react';
import { documentAPI } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

const DocumentChat = ({ documentId, documentName }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    const userQuestion = question.trim();
    setQuestion('');
    
    // Add user question to chat
    setChatHistory(prev => [...prev, {
      type: 'question',
      content: userQuestion,
      timestamp: new Date()
    }]);
    
    setLoading(true);
    
    try {
      const response = await documentAPI.askQuestion({
        document_id: documentId,
        question: userQuestion
      });
      
      // Add AI answer to chat
      setChatHistory(prev => [...prev, {
        type: 'answer',
        content: response.data.answer,
        method: response.data.method,
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Error asking question:', error);
      setChatHistory(prev => [...prev, {
        type: 'error',
        content: 'Sorry, I couldn\'t process your question. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask Questions
        </h3>
        <span className="text-xs text-gray-500 flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
          RAG Enabled
        </span>
      </div>

      {/* Chat History */}
      <div className="mb-4 max-h-96 overflow-y-auto space-y-3">
        {chatHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm">Ask me anything about this document!</p>
            <p className="text-xs text-gray-400 mt-1">I'll find the most relevant information to answer your question.</p>
          </div>
        ) : (
          chatHistory.map((item, index) => (
            <div
              key={index}
              className={`flex ${item.type === 'question' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-lg p-3 ${
                item.type === 'question'
                  ? 'bg-primary-600 text-white'
                  : item.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm">{item.content}</p>
                {item.method && (
                  <span className="text-xs opacity-70 mt-1 block">
                    {item.method === 'openai_rag' ? '🤖 AI + RAG' : 
                     item.method === 'openai_fulltext' ? '🤖 AI' : 
                     '📝 Keyword Match'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <LoadingSpinner size="small" />
            </div>
          </div>
        )}
      </div>

      {/* Question Input */}
      <form onSubmit={handleAskQuestion} className="flex space-x-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this document..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span>Ask</span>
        </button>
      </form>

      {/* Suggested Questions */}
      {chatHistory.length === 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "What is the main topic?",
              "Summarize the key points",
              "What are the important concepts?"
            ].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setQuestion(suggestion)}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentChat;
