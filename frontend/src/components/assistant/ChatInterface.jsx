import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, RotateCcw } from 'lucide-react';
import { assistantAPI, errorMessage } from '../../services/api';
import ChatMessage from './ChatMessage';

const SUGGESTIONS = [
  'Summarise the main ideas',
  'Which concepts should I learn first?',
  'Explain the hardest idea simply',
  'What might an exam ask about this?',
];

const ChatInterface = ({ documentId, document }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await assistantAPI.getChatHistory(documentId);
      setMessages(res.data.messages || []);
      setSessionId(res.data.session_id);
    } catch {
      setMessages([]);
    }
  }, [documentId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
        { role: 'assistant', content: errorMessage(error, 'Something went wrong. Please try again.'), timestamp: new Date().toISOString(), isError: true },
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
        /* best effort */
      }
    }
    setMessages([]);
  };

  return (
    <section className="card flex h-[calc(100vh-17rem)] min-h-[30rem] flex-col">
      <div className="card-header py-3">
        <div>
          <h2 className="card-title">Tutor</h2>
          <p className="muted text-xs">Answers come only from this document, with page references.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm">
            <RotateCcw className="h-3.5 w-3.5" />
            New chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">Ask anything about {document.filename}</h3>
            <p className="muted mt-1 max-w-sm text-sm">
              If the document doesn&apos;t cover something, the tutor will say so instead of guessing.
            </p>
            <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => send(prompt)} className="choice text-left font-normal">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => <ChatMessage key={`${message.timestamp}-${index}`} message={message} />)
        )}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
            <span className="muted text-xs">Reading the relevant pages…</span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 rounded-xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-950"
        >
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
            rows={1}
            placeholder="Ask a question about this document"
            className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-zinc-400 focus:outline-none"
            disabled={loading}
            aria-label="Your question"
          />
          <button type="submit" disabled={!input.trim() || loading} className="btn btn-primary btn-icon rounded-lg" aria-label="Send">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-zinc-400">Enter to send · Shift + Enter for a new line</p>
      </div>
    </section>
  );
};

export default ChatInterface;
