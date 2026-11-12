import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assistantAPI, errorMessage } from '../../services/api';
import ChatMessage from './ChatMessage';

const QUICK_PROMPTS = [
  'Summarize this document',
  'What are the main concepts?',
  'Explain the hardest idea simply',
  'What might an exam ask about this?',
];

const welcome = (filename) => ({
  role: 'assistant',
  content: `Hi! Ask me anything about "${filename}". I answer only from the document and cite the pages I use.`,
  timestamp: new Date().toISOString(),
});

const ChatInterface = ({ documentId, document }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await assistantAPI.getChatHistory(documentId);
      if (res.data.messages?.length) {
        setMessages(res.data.messages);
        setSessionId(res.data.session_id);
      } else {
        setMessages([welcome(document.filename)]);
      }
    } catch {
      setMessages([welcome(document.filename)]);
    }
  }, [documentId, document.filename]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: question, timestamp: new Date().toISOString() }]);
    setInput('');
    setLoading(true);
    try {
      const res = await assistantAPI.chat(documentId, question);
      setSessionId(res.data.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          timestamp: new Date().toISOString(),
          metadata: { sources: res.data.sources, confidence: res.data.confidence },
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorMessage(error, 'Sorry, something went wrong.'), timestamp: new Date().toISOString(), isError: true },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clear = async () => {
    if (sessionId) {
      try {
        await assistantAPI.clearChat(sessionId);
      } catch {
        /* history clear is best-effort */
      }
    }
    setMessages([welcome(document.filename)]);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Chat with your document</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ask questions, request explanations, probe weak spots</p>
        </div>
        {messages.length > 1 && (
          <button type="button" onClick={clear} className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium">
            Clear chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage key={`${message.timestamp}-${index}`} message={message} />
        ))}
        {loading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">🤖</div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 flex space-x-2">
              {[0, 150, 300].map((delay) => (
                <div key={delay} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => send(prompt)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question about this document…"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows="2"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter to send, Shift+Enter for a new line</p>
          </div>
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
