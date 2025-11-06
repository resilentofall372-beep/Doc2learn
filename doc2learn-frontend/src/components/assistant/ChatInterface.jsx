// src/components/assistant/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import { assistantAPI } from '../../services/api';
import ChatMessage from './ChatMessage';
import LoadingSpinner from '../common/LoadingSpinner';

const ChatInterface = ({ documentId, userId, document }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  useEffect(() => {
    loadChatHistory();
  }, [documentId, userId]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const loadChatHistory = async () => {
    try {
      const response = await assistantAPI.getChatHistory(documentId, userId);
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages);
        setSessionId(response.data.session_id);
      } else {
        // Show welcome message
        setMessages([
          {
            role: 'assistant',
            content: `Hi! I'm your AI study assistant. I've analyzed "${document.filename}" and I'm ready to help you understand it better. What would you like to know?`,
            timestamp: new Date().toISOString(),
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };
  
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await assistantAPI.chat(documentId, userId, input.trim());
      
      const assistantMessage = {
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toISOString(),
        metadata: {
          sources: response.data.sources,
          confidence: response.data.confidence,
        }
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setSessionId(response.data.session_id);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleClearChat = async () => {
    if (!sessionId) return;
    
    try {
      await assistantAPI.clearChat(sessionId);
      setMessages([
        {
          role: 'assistant',
          content: 'Chat history cleared. How can I help you?',
          timestamp: new Date().toISOString(),
        }
      ]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };
  
  const handleQuickPrompt = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">💬</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Chat with Document</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ask questions, request explanations, or get summaries
            </p>
          </div>
        </div>
        
        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
          >
            Clear Chat
          </button>
        )}
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        
        {loading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🤖</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Quick Prompts:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Summarize this document',
              'What are the main concepts?',
              'Create a study plan',
              'Generate practice questions'
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about this document..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows="2"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <span>Send</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
