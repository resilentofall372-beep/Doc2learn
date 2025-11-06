// src/components/assistant/ChatMessage.jsx
import React from 'react';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser 
          ? 'bg-indigo-600' 
          : isError 
            ? 'bg-red-100 dark:bg-red-900' 
            : 'bg-indigo-100 dark:bg-indigo-900'
      }`}>
        <span className="text-lg">
          {isUser ? '👤' : isError ? '⚠️' : '🤖'}
        </span>
      </div>
      
      {/* Message Content */}
      <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`max-w-3xl rounded-lg px-4 py-3 ${
          isUser 
            ? 'bg-indigo-600 text-white' 
            : isError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        }`}>
          {/* Message Text */}
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Sources (if available) */}
          {message.metadata?.sources && message.metadata.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
              <p className="text-xs font-semibold mb-1">📚 Sources:</p>
              <div className="flex flex-wrap gap-2">
                {message.metadata.sources.map((source, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300"
                  >
                    Page {source}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Confidence (if available) */}
          {message.metadata?.confidence && (
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                message.metadata.confidence === 'high' 
                  ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200' 
                  : message.metadata.confidence === 'medium'
                    ? 'bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
              }`}>
                {message.metadata.confidence} confidence
              </span>
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`mt-2 text-xs ${
            isUser ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
